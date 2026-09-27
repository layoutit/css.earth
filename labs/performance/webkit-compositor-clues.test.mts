import assert from 'node:assert/strict';
import { test } from 'node:test';
import { compositorClues, compositorTraceEvents } from './webkit-compositor-clues.mts';
import { summariseLayerReply } from './ipad-layer-sampler.mts';
import { options } from './ios-capture.mts';
const stamp=(id:number,phase:string,ts:number)=>({name:'TimeStamp',ts,ph:'i',pid:1,tid:1,args:{data:{message:`cssEarth:layers:${id}:${phase}`}}});
test('native absent, native present and unmapped parents remain distinct and retain exact attachment operations',()=>{
  const trace={traceEvents:[stamp(1,'begin',10),stamp(1,'end',20),stamp(2,'begin',30),stamp(2,'end',40)]};
  const samples=[{kind:'node',nodeId:123,description:{target:7,label:'div.body'}},
    {kind:'layers',id:1,dom:{frame:4,groups:[{target:7,label:'div.body',directLeaves:64},{target:9,label:'div.unknown',directLeaves:2}]},layers:[]},
    {kind:'layers',id:2,dom:{frame:6,groups:[{target:7,label:'div.body',directLeaves:64}]},layers:[{nodeId:123,layerId:'native-1',memory:0}]}];
  const causes={operations:[{id:77,target:7,kind:'children',property:'insertBefore',frame:3,structureBefore:{elements:0},structureAfter:{elements:1}}]};
  const result=compositorClues(trace,samples,causes);
  assert.deepEqual(result.observations.map(o=>o.status),['absent','unmapped','present']);
  assert.deepEqual(result.groups[0].absentSampleIds,[1]);
  assert.equal(result.groups[0].firstObservedPresent,2);
  assert.equal(result.groups[0].attachmentOperations[0].id,77);
  assert.equal(compositorTraceEvents(result)[1].ts,20);
});
test('unpaired clocks are kept in analysis but excluded from timed events',()=>{
  const result=compositorClues({traceEvents:[]},[{kind:'layers',id:2,dom:{groups:[{target:7,directLeaves:1}]},layers:[]}],null);
  assert.equal(result.observations[0].endUs,null);
  assert.equal(compositorTraceEvents(result).length,1);
});
test('sampler preserves native parent IDs and validates protocol failure',()=>{
  assert.equal(summariseLayerReply({result:{layers:[{nodeId:3,layerId:'x',parentLayerId:'p',memory:12}]}}).layers[0].parentLayerId,'p');
  assert.throws(()=>summariseLayerReply({error:'bad'}),/failed/);
});
test('heavy hooks and style capture are opt-in',()=>{
  const plain=options(['--device','--name','x','--seconds','1']);
  const debug=options(['--device','--name','x','--seconds','1','--debug']);
  assert.equal(plain.debug,false);assert.equal(plain.styleWrites,false);
  assert.equal(debug.debug,true);assert.equal(debug.styleWrites,true);
});
test('a new Inspector node ID supersedes the old mapping for the same retained DOM node',()=>{
 const samples=[{kind:'node',nodeId:1,description:{target:7}},
 {kind:'node',nodeId:2,description:{target:7}},
 {kind:'layers',id:1,nativeGroupNodeIds:[2],dom:{groups:[{target:7,directLeaves:64}]},layers:[{nodeId:2,layerId:'new'}]}];
 const result=compositorClues({traceEvents:[stamp(1,'begin',1),stamp(1,'end',2)]},samples,null);
 assert.equal(result.observations[0].backendNodeId,2);assert.equal(result.observations[0].status,'present');
});
