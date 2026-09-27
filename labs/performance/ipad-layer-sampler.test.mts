import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { startLayerSampler } from './ipad-layer-sampler.mts';
test('uses the refreshed native root and receives deep child identities before describing layers', async () => {
 const directory=await mkdtemp(join(tmpdir(),'native-layers-'));
 let listener: (source:string,message:Record<string,unknown>)=>void=()=>{};
 let documents=0;
 const file=join(directory,'layers.jsonl');
 const session={listen(next: typeof listener){listener=next;},async send(method:string,params?:Record<string,unknown>):Promise<unknown>{
  if(method==='DOM.getDocument'){documents++;return {result:{root:{nodeId:100,nodeName:'#document'}}};}
  if(method==='DOM.requestChildNodes'){assert.equal(params?.nodeId,100);listener('',{method:'DOM.setChildNodes',params:{parentId:100,nodes:[{nodeId:101,nodeName:'U',attributes:['style','background-image:url(atlas.webp)']}]}});return {result:{}};}
  if(method==='LayerTree.layersForNode'){assert.equal(params?.nodeId,100);return {result:{layers:[{nodeId:101,layerId:'face',memory:4}]}};}
  if(method==='DOM.querySelectorAll')return {result:{nodeIds:[]}};
  return {result:{result:{value:{groups:[]}}}};
 }};
 try {const sampler=await startLayerSampler(session,file);await sampler.stop();const rows=(await readFile(file,'utf8')).trim().split('\n').map(line => JSON.parse(line));
  assert.equal(documents,1);assert.ok(rows.some(row=>row.kind==='paint-node'&&row.nodeId===101&&row.name==='U'));assert.equal(rows.some(row=>row.kind==='error'),false);
 }finally{await rm(directory,{recursive:true,force:true});}
});
