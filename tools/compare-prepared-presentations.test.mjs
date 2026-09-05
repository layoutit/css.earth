import assert from 'node:assert/strict';
import test from 'node:test';
import {requireCaptureState,requireCaptureReports} from './compare-prepared-presentations.mjs';
const state=()=>({prefix:'moon-1440-scale1-lens-surface',kind:'scene',pose:'lens-surface',
  poseState:{lens:'surface'},observedPose:{zoom:1},loadedAssets:[['/scenes/moon/moon-surface.webp','original']],
  versionLabel:'0.1',gpu:{renderer:'Apple'},frameSha256s:['a','b']});
test('changed imagery, pose, GPU, version and missing readbacks fail outside representation receipts',()=>{
  for(const mutate of [c=>c.loadedAssets[0][1]='different',c=>c.observedPose.zoom=2,
    c=>c.gpu.renderer='software',c=>c.versionLabel='0.2',c=>c.frameSha256s.pop()]) {
    const a=state(),b=state();mutate(b);assert.throws(()=>requireCaptureState(a,b));
  }
});
test('a control correction cannot waive imagery or camera checks',()=>{
  const a=state(),b=state();b.poseState.lens='cross-section';
  const change={before:{poseState:a.poseState,observedPose:a.observedPose},after:{poseState:b.poseState,observedPose:b.observedPose}};
  requireCaptureState(a,b,change);
  b.observedPose={zoom:2};
  assert.throws(()=>requireCaptureState(a,b,{...change,after:{...change.after,observedPose:b.observedPose}}),/non-lens/);
  b.observedPose=a.observedPose;
  b.loadedAssets[0][1]='altered';assert.throws(()=>requireCaptureState(a,b,change),/loadedAssets/);
});
test('incomplete and error-bearing capture reports cannot qualify',()=>{
  assert.throws(()=>requireCaptureReports({complete:false},{}),/Complete/);
  assert.throws(()=>requireCaptureReports({complete:true,errors:['failed']},{}),/Capture errors/);
});
test('an explicit package subset requires a complete sealed source report', async () => {
  const { selectCaptureObjects } = await import('./compare-prepared-presentations.mjs');
  const files = ['audit-shared-runtime','runtime-audit-poses','audit-source-identity','readback-sequence','object-contract-visual','saturn-scene-coverage'];
  const scenario = {dprs:[1],defaultWidths:[1440],poseWidths:[1440],poses:[]};
  const report = { complete:true,errors:[],sourceIdentity:{sha256:'a'.repeat(64)},objectIds:['moon','pluto'],expectedCaptureCount:4,
    scenarios:{moon:scenario,pluto:scenario},harnessHashes:Object.fromEntries(files.map(file=>[`tools/${file}.mjs`,'a'])),
    captures:['moon','pluto'].flatMap(id=>['shell','scene'].map(kind=>({prefix:`${id}-1440-scale1`,kind}))) };
  const selected=selectCaptureObjects(report,['moon']);
  assert.equal(selected.captures.length,2); assert.equal(selected.expectedCaptureCount,2);
  requireCaptureReports(selected,selected);
  assert.throws(()=>selectCaptureObjects({...report,complete:false},['moon']),/Complete/);
  assert.throws(()=>selectCaptureObjects(report,['venus']),/Missing captured/);
  assert.throws(()=>selectCaptureObjects({...report,captures:report.captures.slice(0,3)},['moon']),/Complete capture/);
});
