/** Join Inspector node identities to observed DOM groups; missing observations stay unknown. */
import { isRecord } from '@cssearth/core';
import { dataOf, isTraceEvent, type TraceEvent } from './trace-model.mts';
const rows = (v: unknown) => Array.isArray(v) ? v.filter(isRecord) : [];
export function compositorClues(trace: unknown, samples: readonly unknown[], causes: unknown) {
  const events = rows(isRecord(trace) ? trace.traceEvents : []).filter((event): event is Record<string, unknown> & TraceEvent => isTraceEvent(event));
  const intervals = new Map<number, { begin?: number; end?: number }>();
  for (const e of events) {
    const match = /^cssEarth:layers:(\d+):(begin|end)$/.exec(String(dataOf(e).message ?? ''));
    if (match) { const id=Number(match[1]), interval=intervals.get(id)??{}; if(match[2]==='begin')interval.begin=e.ts;else interval.end=e.ts;intervals.set(id,interval); }
  }
  const identities = new Map<number, Record<string, unknown>>();
  const observations: Record<string, unknown>[] = [];
  for(const row of samples.filter(isRecord)) {
    if(row.kind==='node'&&typeof row.nodeId==='number'&&isRecord(row.description))identities.set(row.nodeId,row.description);
    if(row.kind!=='layers'||!isRecord(row.dom))continue;
    const groups=rows(row.dom.groups), layers=rows(row.layers), interval=intervals.get(Number(row.id));
    for(const group of groups) {
      if(typeof group.directLeaves!=='number'||group.directLeaves===0)continue;
      const native=[...identities].reverse().find(([id,v])=>v.target===group.target && (!Array.isArray(row.nativeGroupNodeIds)||row.nativeGroupNodeIds.includes(id)));
      const layer=native?layers.find(l=>l.nodeId===native[0]):undefined;
      observations.push({sampleId:row.id,startUs:interval?.begin??null,endUs:interval?.end??null,
        frame:row.dom.frame,url:row.dom.url,group,backendNodeId:native?.[0]??null,layer:layer??null,
        status:native?(layer?'present':'absent'):'unmapped',
        relation:'Native layer observation within marked asynchronous interval; group child count was read at interval start.'});
    }
  }
  const operations=rows(isRecord(causes)?causes.operations:[]);
  const groups=[...new Set(observations.map(o=>isRecord(o.group)?o.group.target:null))].map(target=>{
    const observed=observations.filter(o=>isRecord(o.group)&&o.group.target===target);
    const writes=operations.filter(o=>o.target===target&&o.kind==='children');
    return {target,label:isRecord(observed[0]?.group)?observed[0].group.label:null,
      attachmentOperations:writes.map(o=>({id:o.id,frame:o.frame,property:o.property,structureBefore:o.structureBefore,structureAfter:o.structureAfter,arguments:o.arguments})),
      firstObservedPresent:observed.find(o=>o.status==='present')?.sampleId??null,
      absentSampleIds:observed.filter(o=>o.status==='absent').map(o=>o.sampleId),observations:observed.length};
  });
  return {enabled:samples.length>0,groups,observations,coverage:samples.filter(isRecord).filter(r=>r.kind==='coverage'||r.kind==='error'||r.kind==='unresolved-node'),
    limitations:['Layer observations are not proof of successful on-screen pixels.','This protocol does not expose GPU tile eviction reasons.','Missing or coalesced snapshots cannot establish the exact creation frame.']};
}
export function compositorTraceEvents(clues: ReturnType<typeof compositorClues>): Record<string,unknown>[] {
  if(!clues.enabled)return [];
  return [{ph:'M',pid:1,tid:4,name:'thread_name',args:{name:'Diagnostic compositor observations (overhead included)'}},
    ...clues.observations.flatMap(o=>typeof o.startUs!=='number'||typeof o.endUs!=='number'?[]:[{
      ph:'i',s:'t',pid:1,tid:4,cat:'cssearth.compositor',name:`Leaf parent layer ${o.status}: ${isRecord(o.group)?o.group.label:''}`,ts:o.endUs,args:{data:o}}])];
}
