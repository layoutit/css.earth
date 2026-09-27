import { test } from 'node:test';
import assert from 'node:assert/strict';
import { paintClues, paintTraceEvents } from './webkit-paint-clues.mts';
const stamp = (message: string, ts: number) => ({name:'TimeStamp',ts,pid:1,tid:1,args:{data:{message}}});
test('joins decode, detached mesh membership and later texture writes without inventing a paint identity', () => {
  const trace = {traceEvents:[stamp('cssEarth:decode:1:begin',1),stamp('cssEarth:decode:1:end',4),
    stamp('cssEarth:cause:1:begin',10),stamp('cssEarth:cause:1:end',11),stamp('cssEarth:cause:2:begin',12),stamp('cssEarth:cause:2:end',13),
    {name:'Paint',ts:15,dur:50,pid:1,tid:1,args:{data:{clip:[0,0,10,10]}}}]};
  const source = {schema:'cssearth-trace-causes@1', targets:[{id:1,label:'stage'},{id:2,label:'u'}],
    operations:[{id:1,target:1,kind:'children',property:'appendChild'},{id:2,target:2,kind:'style',property:'backgroundImage',image:'url("/atlas.webp")',frame:2}],
    attachments:[{operationId:1,trees:[{root:2,elements:1,leaves:1,nodes:[{target:2,image:'none'}]}]}],
    decodes:[{id:1,url:'https://local/atlas.webp',status:'resolved',width:1024,height:1024}]};
  const result=paintClues(trace,source,[], 'https://local/earth/');
  assert.equal(result.attachments[0].assets[0].decodedBeforeConnection,true);
  assert.equal(result.attachments[0].textureBatches[0].writes,1);
  assert.equal(result.attachments[0].firstSubsequentPaintMs,0.05);
  assert.equal(result.expensivePaints[0].nativeNode,null);
  assert.equal(result.paintsWithNodeId,0);
  assert.ok(paintTraceEvents(result).some(e=>e.name==='Texture activation: 1 writes'));
});
test('unpaired and pre-install decodes do not become proof of readiness',()=>{
 const result=paintClues({traceEvents:[]},{attachments:[{operationId:1,trees:[{nodes:[{target:1,image:'url("a.webp")'}]}]}],decodes:[{id:1,url:'a.webp',status:'resolved'}]},[]);
 assert.equal(result.attachments[0].assets[0].decodedBeforeConnection,false);
 assert.equal(result.decodes[0].endUs,null);
 assert.equal(paintTraceEvents(paintClues({traceEvents:[]},null,[])).length,0);
});

test('keeps worker and main-thread native paths separate and labels clock overlap', () => {
 const stack='WebPReadPlugin::decodeWebP < ShareableBitmap::createFromImagePixels';
 const trace={traceEvents:[stamp('cssEarth:decode:1:begin',1),stamp('cssEarth:decode:1:end',10),
  {name:'thread_name',ts:0,pid:3,tid:1,ph:'M',args:{name:'Main Thread'}},
  {name:'thread_name',ts:0,pid:3,tid:2,ph:'M',args:{name:'Worker'}},
  {name:'decode',ts:3,pid:3,tid:1,ph:'X',cat:'native',args:{stack,weightMs:1}},
  {name:'decode',ts:4,pid:3,tid:2,ph:'X',cat:'native',args:{stack,weightMs:1}}]};
 const result=paintClues(trace,{decodes:[{id:1,url:'a.webp',status:'resolved'}]},[]);
 assert.deepEqual(result.decodes[0].native.imageWork.map(group=>group.thread),['Main Thread','Worker']);
 assert.match(result.decodes[0].native.relation,/Approximate clock overlap/);
});

test('surfaces decoded-data destruction from native cache callbacks without inventing image identity', () => {
 const result=paintClues({traceEvents:[{name:'sample',ts:100,pid:3,tid:1,ph:'X',cat:'native',args:{stack:'ImageFrame::clearImage < CachedImage::didReplaceSharedBufferContents < NetworkProcessConnection::didCacheResource'}}]},null,[]);
 assert.equal(result.nativeImageLifecycle[0].reason,'encoded-buffer replacement');
 assert.match(result.nativeImageLifecycle[0].relation,/image URL unavailable/);
});


test('commit evidence includes GPU samples without merging same-named threads', () => {
 const trace={traceEvents:[{name:'Commit',ph:'X',pid:1,tid:1,ts:100,dur:1000},
  {name:'copy',cat:'native',ph:'X',pid:3,tid:1,ts:200,args:{stack:'copy',nativePid:40}},
  {name:'copy',cat:'native',ph:'X',pid:4,tid:1,ts:200,args:{stack:'copy',nativePid:50}}]};
 const result=paintClues(trace,null,[]);
 assert.equal(result.expensiveCommits[0].native.sampleCount,2);
 assert.deepEqual(result.expensiveCommits[0].native.stacks.map(row=>row.pid),[40,50]);
});
