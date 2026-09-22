import assert from "node:assert/strict";
import { sourceTest } from '../../tests/objects/source-test.mts';
const test = sourceTest();
import { required } from './navigation-test-values.mts';
import type { MotionInput, MotionHistory, MotionEvent } from './rendered-motion-steps.mts';
import { renderedMotionSteps } from "./rendered-motion-steps.mts";

function fixture() {
  const frames=[100.016,100.04,100.08,100.10].map((monotonicSeconds,index)=>({index,monotonicSeconds}));
  const history=[
    {t:100,clock:10,length:1,average:[0,0]},
    {t:100.034,clock:10.034,length:3,average:[0,0]},
    {t:100.07,clock:10.07,length:3,average:[1,0]},
    {t:100.09,clock:10.09,length:3,average:[1,0]},
  ].map(h=>({...h,object:0,history:[[0,0,10.001]]}));
  const native: MotionInput<MotionEvent, typeof frames[number]> & { consumedGesture: MotionEvent[]; frames: typeof frames; consumedInputEvidence: { clockOffsetSeconds: number; launch: MotionHistory; gestures?: { events: MotionEvent[]; launch: MotionHistory | null }[] } }={frames,consumedGesture:[
    {kind:'down',atMilliseconds:1},
    {kind:'drag',atMilliseconds:20},
    {kind:'drag',atMilliseconds:21},
    {kind:'up',atMilliseconds:71},
  ],inputs:[{event:'native-input-batch-accepted',acceptedMonotonicSeconds:100}],
  consumedInputEvidence:{clockOffsetSeconds:90,launch:history[2]}};
  const timing=history.map(h=>[h.t,.034,h.clock]);
  timing[3][2]=timing[2][2];
  return {native,history,timing};
}

test('keeps reversal and every camera-advancing present in its recorded step',()=>{
  const f=fixture(),steps=renderedMotionSteps(f.native,f.history,f.timing);
  assert.deepEqual(steps.map(s=>s.events.map(e=>e.kind)),[['down'],['drag','drag'],['up'],[]]);
  assert.deepEqual(steps.flatMap(s=>s.captures.map(f=>f.index)),[0,1,2,3]);
  assert.equal(steps[1].launched,false);
  assert.equal(steps[2].launched,true);
  assert.equal(steps[3].tick,true);
  assert.equal(steps[3].callbackMilliseconds-steps[2].callbackMilliseconds,34);
});

test('advances uncaptured native frames instead of skipping their camera work',()=>{
  const f=fixture();f.native.frames.splice(1,1);
  const steps=renderedMotionSteps(f.native,f.history,f.timing);
  assert.equal(steps.length,4);
  assert.equal(steps[1].captures.length,0);
  assert.equal(steps[1].events.length,2);
  assert.deepEqual(steps.flatMap(s=>s.captures.map(f=>f.index)),[0,2,3]);
});

test('rejects missing frame clocks and an already moving start',()=>{
  const f=fixture();
  assert.throws(()=>renderedMotionSteps(f.native,f.history,f.timing.slice(1)),/own frame-period/);
  f.history[0].length=2;
  assert.throws(()=>renderedMotionSteps(f.native,f.history,f.timing),/before the first drag/);
});

test('does not replay a preceding gesture still retained before the new press',()=>{
  const f=fixture();
  f.history[0]={...f.history[0],length:13,history:[[0,0,9]],average:[2,1]};
  const steps=renderedMotionSteps(f.native,f.history,f.timing);
  assert.deepEqual(steps[0].events,[]);
  assert.equal(steps[0].launched,false);
  assert.deepEqual(steps[1].events.map(e=>e.kind),['down','drag','drag']);
});

test('ignores a pointer point stored after a non-launching release',()=>{
  const f=fixture();
  f.history[3].length=4;
  const steps=renderedMotionSteps(f.native,f.history,f.timing);
  assert.deepEqual(steps.flatMap(step=>step.events.map(event=>event.kind)),
    ['down','drag','drag','up']);
});

test('pairs a fresh press during coast, held jitter and a second release independently',()=>{
  const f=fixture();
  const second=[
    {kind:'down',atMilliseconds:120},
    {kind:'drag',atMilliseconds:420},
    {kind:'drag',atMilliseconds:640},
    {kind:'up',atMilliseconds:675},
  ];
  const extra=[
    {t:100.12,clock:10.12,length:1,average:[0,0]},
    {t:100.42,clock:10.42,length:2,average:[0,0]},
    {t:100.64,clock:10.64,length:3,average:[0,0]},
    {t:100.68,clock:10.68,length:3,average:[-1,0]},
  ].map(h=>({...h,object:0,history:[[0,0,10.12]]}));
  f.native.consumedInputEvidence.gestures=[
    {events:f.native.consumedGesture,launch:f.history[2]},
    {events:second,launch:extra[3]},
  ];
  f.native.consumedGesture=[...f.native.consumedGesture,...second];
  f.native.frames.push(...extra.map((h,i)=>({index:4+i,monotonicSeconds:h.t+.001})));
  f.history.push(...extra);
  f.timing.push(...extra.map(h=>[h.t,.034,h.clock]));
  const steps=renderedMotionSteps(f.native,f.history,f.timing);
  assert.deepEqual(steps.flatMap(s=>s.events).map(({beforeTick,afterTick,...event})=>event),f.native.consumedGesture);
  assert.ok(steps.flatMap(s=>s.events).every(e=>e.kind==='up'?e.afterTick:e.beforeTick));
  assert.deepEqual(steps.slice(4).map(s=>s.events.map(e=>e.kind)),[['down'],['drag'],['drag'],['up']]);
  assert.deepEqual(steps.slice(4).map(s=>s.released),[false,false,false,true]);
  assert.deepEqual(steps.flatMap(s=>s.captures.map(c=>c.index)),[0,1,2,3,4,5,6,7]);
  f.history.splice(2,2);f.timing.splice(2,2);
  assert.throws(()=>renderedMotionSteps(f.native,f.history,f.timing),/preceding release/);
});

test('binds click-only receipts without fabricating a drag launch',()=>{
  const frames=[100.01,100.04,100.08,100.12].map((monotonicSeconds,index)=>({index,monotonicSeconds}));
  const native={frames,gesture:[
    {kind:'down',atMilliseconds:15},
    {kind:'up',atMilliseconds:25},
    {kind:'down',atMilliseconds:55,clickCount:2},
    {kind:'up',atMilliseconds:65,clickCount:2},
  ],consumedGesture:[
    {kind:'down',atMilliseconds:15},
    {kind:'up',atMilliseconds:25},
    {kind:'down',atMilliseconds:55,clickCount:2},
    {kind:'up',atMilliseconds:65,clickCount:2},
  ],inputs:[{event:'native-input-batch-accepted',acceptedMonotonicSeconds:100}]};
  const timing=frames.map(frame=>[frame.monotonicSeconds,.03,frame.monotonicSeconds-90]);
  const steps=renderedMotionSteps(native,[],timing);
  assert.deepEqual(steps.map(step=>step.events.map(event=>event.kind)),[
    [],['down','up'],['down','up'],[],
  ]);
  assert.deepEqual(steps.flatMap(step=>step.captures.map(frame=>frame.index)),[0,1,2,3]);
});

test('advances an uncaptured receipt-only present',()=>{
  const frames=[100.01,100.04,100.08].map((monotonicSeconds,index)=>
    ({index,monotonicSeconds}));
  const native={frames,consumedGesture:[
    {kind:'down',atMilliseconds:55},
    {kind:'up',atMilliseconds:65},
  ],inputs:[{event:'native-input-batch-accepted',acceptedMonotonicSeconds:100}]};
  const timing=[100.01,100.04,100.06,100.08].map(present=>
    [present,.02,present-90]);
  const steps=renderedMotionSteps(native,[],timing);
  assert.equal(steps.length,4);
  assert.deepEqual(steps.map(step=>step.captures.length),[1,1,0,1]);
  assert.deepEqual(steps.map(step=>step.events.map(event=>event.kind)),
    [[],[],['down'],['up']]);
});

test('binds click receipts before a later drag without treating clicks as launches',()=>{
  const f=fixture();
  const clicks=[
    {kind:'down',atMilliseconds:-20},
    {kind:'up',atMilliseconds:-10,clickCount:2},
  ];
  f.native.consumedInputEvidence.gestures=[
    {events:clicks,launch:null},
    {events:f.native.consumedGesture,launch:f.history[2]},
  ];
  f.native.consumedGesture=[...clicks,...f.native.consumedGesture];
  const steps=renderedMotionSteps(f.native,f.history,f.timing);
  assert.deepEqual(steps[0].events.map(event=>event.kind),['down','up','down']);
  assert.deepEqual(steps.flatMap(step=>step.events).map(
    ({beforeTick,afterTick,...event})=>event),
    f.native.consumedGesture);
});

test('pairs a source-consumed drag and following stop click',()=>{
  const f=fixture();
  const click=[
    {kind:'down',atMilliseconds:120},
    {kind:'up',atMilliseconds:145},
  ];
  const reset={t:100.16,clock:10.16,length:1,average:[0,0],object:0,
    history:[[0,0,10.155]]};
  f.native.consumedInputEvidence.gestures=[
    {events:f.native.consumedGesture,launch:f.history[2]},
    {events:click,launch:null},
  ];
  f.native.consumedGesture=[...f.native.consumedGesture,...click];
  f.native.frames.push({index:4,monotonicSeconds:100.161});
  f.history.push(reset);
  f.timing.push([reset.t,.034,reset.clock]);
  const steps=renderedMotionSteps(f.native,f.history,f.timing);
  assert.deepEqual(steps.flatMap(step=>step.events).map(event=>event.kind),
    ['down','drag','drag','up','down','up']);
  assert.ok(required(steps.at(-1)).events.every(event=>event.afterTick));
  assert.equal(required(steps.at(-1)).launched,false);
});
