/** Opt-in native compositor observations. No timers or Inspector work on normal traces. */
import { appendFile } from 'node:fs/promises';
import { isRecord } from '@cssearth/core';
type Inspector = {
  send(method: string, params?: Record<string, unknown>): Promise<unknown>;
  listen(listener: (source: string, message: Record<string, unknown>) => void): unknown;
};
export function summariseLayerReply(reply: unknown) {
  if (!isRecord(reply) || !isRecord(reply.result) || !Array.isArray(reply.result.layers))
    throw new Error(`LayerTree.layersForNode failed: ${JSON.stringify(reply).slice(0, 300)}`);
  const layers = reply.result.layers.filter(isRecord);
  return { count: layers.length, bytes: layers.reduce((sum, layer) => sum + (typeof layer.memory === 'number' ? layer.memory : 0), 0),
    layers: layers.map(layer => ({ ...layer })) };
}
const result = (reply: unknown) => isRecord(reply) && isRecord(reply.result) ? reply.result : null;
const value = (reply: unknown) => { const r = result(reply); return r && isRecord(r.result) ? r.result.value : null; };
export async function startLayerSampler(session: Inspector, file: string) {
  const snapshots: unknown[] = [], identified = new Set<number>(), reasons = new Map<string, unknown>();
  let rootNode: number | null = null;
  let stopped = false, wanted = false, pending: Promise<void> | null = null, sequence = 0, coalesced = 0;
  const save = async (record: unknown) => { snapshots.push(record); await appendFile(file, `${JSON.stringify(record)}\n`); };
  const evaluate = (expression: string) => session.send('Runtime.evaluate', { expression, returnByValue: true });
  const sample = async () => {
    const id = ++sequence, requestedAt = Date.now();
    try {
      await evaluate(`console.timeStamp('cssEarth:layers:${id}:begin')`);
      if (rootNode === null) {
        const document = result(await session.send('DOM.getDocument'));
        const root = document && isRecord(document.root) ? document.root.nodeId : null;
        if (typeof root !== 'number') throw new Error('No document for compositor observation.');
        rootNode = root;
      }
      const root = rootNode;
      const dom = value(await evaluate('window.__captureCauses ? window.__captureCauses.snapshot() : null'));
      const tree = summariseLayerReply(await session.send('LayerTree.layersForNode', { nodeId: root }));
      // Include parents with NO layer, not just nodes already reported by LayerTree.
      const found = result(await session.send('DOM.querySelectorAll', { nodeId: root,
        selector: '.object-render-root, .object-render-root .polycss-mesh' }));
      for (const nodeId of Array.isArray(found?.nodeIds) ? found.nodeIds : []) {
        if (stopped || typeof nodeId !== 'number' || identified.has(nodeId)) continue;
        const resolved = result(await session.send('DOM.resolveNode', { nodeId, objectGroup: 'cssearth-layer-debug' }));
        const objectId = resolved && isRecord(resolved.object) ? resolved.object.objectId : null;
        if (typeof objectId !== 'string') { await save({kind:'unresolved-node',id,nodeId,reply:resolved}); continue; }
        const description = value(await session.send('Runtime.callFunctionOn', { objectId, returnByValue: true,
          functionDeclaration: 'function(){return window.__captureCauses ? window.__captureCauses.describeNode(this) : null;}' }));
        await session.send('Runtime.releaseObject', { objectId });
        if (isRecord(description)) { identified.add(nodeId); await save({kind:'node',id,nodeId,description}); }
      }
      const structural = new Set(Array.isArray(found?.nodeIds) ? found.nodeIds : []);
      for (const layer of tree.layers) if (structural.has(layer.nodeId) && typeof layer.layerId === 'string' && !reasons.has(layer.layerId)) {
        reasons.set(layer.layerId, result(await session.send('LayerTree.reasonsForCompositingLayer', {layerId:layer.layerId})));
      }
      await evaluate(`console.timeStamp('cssEarth:layers:${id}:end')`);
      await save({kind:'layers',id,requestedAt,atEpochMs:Date.now(),dom,...tree,nativeGroupNodeIds:Array.isArray(found?.nodeIds)?found.nodeIds:[],
        structuralReasons:tree.layers.filter(l=>structural.has(l.nodeId)).map(l=>({layerId:l.layerId,reasons:reasons.get(String(l.layerId))})),
        observation:'Asynchronous native snapshot within marked interval; not an atomic DOM/compositor transaction.'});
    } catch(error) { await save({kind:'error',id,requestedAt,atEpochMs:Date.now(),error:String(error)}); stopped=true; }
  };
  const request = () => {
    if(stopped||sequence>=2000)return;
    if(pending){wanted=true;coalesced++;return;}
    pending=(async()=>{do{wanted=false;await sample();}while(wanted&&!stopped&&sequence<2000);})().finally(()=>{pending=null;});
  };
  session.listen((_source,message)=>{if(message.method==='DOM.documentUpdated'){rootNode=null;identified.clear();}if(message.method==='LayerTree.layerTreeDidChange')request();});
  await session.send('LayerTree.enable'); request();
  return { async stop(){stopped=true;await pending;await save({kind:'coverage',snapshots:sequence,coalesced,limit:2000,
    limitations:['No GPU tile residency/eviction reason exposed by this protocol.','Layer absence is an observation, not by itself proof of a paint defect.','Coalesced changes can hide intermediate states.']});return snapshots;} };
}
