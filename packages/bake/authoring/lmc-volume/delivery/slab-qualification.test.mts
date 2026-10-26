import assert from 'node:assert/strict';import test from 'node:test';
import {SLAB_CAMERAS,qualifySlabViews,isolatedMergedCeiling,isolatedMergedChannel} from './slab-qualification.mts';
const valid=()=>SLAB_CAMERAS.map(name=>({name,lightDifferencePercent:0,annulusDifferencePercent:[0,0,0,0],channelShareDifferencePercentagePoints:[[0,0,0],[0,0,0],[0,0,0]],passed:true}));
test('slab admission requires all cameras and measured light, radial and color agreement',()=>{
 assert.equal(qualifySlabViews(valid()).passed,true);
 for(const change of [
  (v:ReturnType<typeof valid>[number])=>{v.lightDifferencePercent=2.01;},
  (v:ReturnType<typeof valid>[number])=>{v.lightDifferencePercent=-5.01;},
  (v:ReturnType<typeof valid>[number])=>{v.annulusDifferencePercent[2]=10.01;},
  (v:ReturnType<typeof valid>[number])=>{v.channelShareDifferencePercentagePoints[1]![2]=3.01;},
 ]){const rows=valid();change(rows[7]!);assert.throws(()=>qualifySlabViews(rows),'A lying success flag must fail');rows[7]!.passed=false;assert.equal(qualifySlabViews(rows).passed,false);}
 assert.throws(()=>qualifySlabViews(valid().slice(1)));const duplicate=valid();duplicate[1]!.name='earth';assert.throws(()=>qualifySlabViews(duplicate));
});
test('the documented scalar-alpha rule has an analytic ceiling even when channel gain is increased',()=>{
 assert.equal(isolatedMergedCeiling(),1/3);for(const gain of [.1,1,10,1000])for(const channel of [0,.5,1])assert.ok(isolatedMergedChannel(channel,gain)<=isolatedMergedCeiling());
 assert.equal(isolatedMergedChannel(.8,1000),1/3);assert.equal(isolatedMergedChannel(1,1000,0),0);
});
