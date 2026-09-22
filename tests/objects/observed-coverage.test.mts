import assert from 'node:assert/strict';
import { sourceTest } from './source-test.mts';
const test = sourceTest();
import {polarZeroCoverage,resizeObservedRgb,prepareMeasuredPolarAtlas} from '../../tools/objects/observed-coverage.mts';
import {measureScalarCoverage,finitePercentiles} from '../../tools/objects/giant-observations/scalar-coverage.mts';

test('polar fill is unavailable while black terrain, faint signal and negative finite measurements survive',()=>{
  const values=new Float64Array(8*8).fill(100);
  values.fill(0,0,8);values.fill(0,56);values[27]=0;values[28]=.0001;values[35]=-1;values[36]=NaN;
  const result=measureScalarCoverage({width:8,height:8,values},{noData:0,coverage:'polar-connected-zero'});
  assert.equal(result.sourceMissingPixels,17);
  for(const i of [27,28,35])assert.equal(result.missing[i],0);
  assert.equal(result.missing[36],1);assert.equal(result.values[28],.0001);assert.equal(result.values[35],-1);
  assert.deepEqual(finitePercentiles(values,0,1,.5,result.missing),[-1,100]);
});

test('display-image gap classification never uses a brightness cutoff',()=>{
 const info={width:5,height:5,channels:3},data=Buffer.alloc(75,130);data.fill(0,0,15);data.fill(0,60);
 data.fill(0,36,39);data.fill(1,39,42);data.fill(63,42,45);
 const missing=polarZeroCoverage(data,info);
 assert.equal(missing.reduce((a,b)=>a+b),10);
 for(const i of [12,13,14])assert.equal(missing[i],0);
 const resized=resizeObservedRgb({data,info,missing},5,5);
 assert.deepEqual([...resized.data.subarray(36,45)],[0,0,0,1,1,1,63,63,63]);
 assert.ok([...resized.data.subarray(0,3)].every(v=>v>=80&&v<=116));
});

test('interpolation with a missing contributor produces a neutral gap rather than substituted source color',()=>{
 const source={data:Buffer.from([255,0,0,0,0,255,0,255,0,255,255,255]),info:{width:2,height:2,channels:3},missing:new Uint8Array([1,0,0,0])};
 const result=resizeObservedRgb(source,1,1);
 assert.equal(result.missing[0],1);assert.ok([...result.data].every(v=>v>=80&&v<=116));
 source.missing.fill(0);assert.deepEqual([...resizeObservedRgb(source,1,1).data],[128,128,128]);
});

test('both polar projection conventions preserve unavailable poles instead of extending the observed boundary',()=>{
 const info={width:64,height:32,channels:3},data=Buffer.alloc(64*32*3,220),missing=new Uint8Array(64*32);
 missing.fill(1,0,64*4);missing.fill(1,64*28);
 for(const projection of ['latitude-linear','orthographic'] as const){
  const polar=prepareMeasuredPolarAtlas({data,info,missing},32,{projection,boundaryLatitudeDegrees:80,overlap:1.035});
  for(const pole of [0,1]){
   const o=(16*64+pole*32+16)*4;assert.ok([...polar.data.subarray(o,o+3)].every(v=>v>=80&&v<=116));assert.equal(polar.data[o+3],255);
  }
  assert.ok(polar.missingPixels>0);assert.equal(polar.stabilization.model,'measured-polar-projection-with-neutral-gaps');
 }
});
