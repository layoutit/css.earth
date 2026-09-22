import { sourceTest } from '../../../tests/objects/source-test.mts';
const test = sourceTest();
import assert from 'node:assert/strict';
import {matchImageFeatures,type MatchRaster} from './image-feature-matching.mts';

const policy={patchRadius:4,searchRadius:9,gridStride:13,gridOrigin:14,targetSmoothingSigma:.35,minimumCorrelation:.86,minimumPeakMargin:.03,minimumJointValidFraction:.85};
test('image matching recovers a translation despite exposure changes and flagged pixels',()=>{
  const size=104,margin=18,dx=4,dy=-3;
  const signal=(x:number,y:number)=>3+Math.sin(x*.81+y*.43)+Math.cos(x*.21-y*.69)+Math.sin(x*.07*y*.09);
  const make=(width:number,height:number,pixel:(x:number,y:number)=>number):MatchRaster=>({width,height,values:Float32Array.from({length:width*height},(_,i)=>pixel(i%width,Math.floor(i/width))),valid:Uint8Array.from({length:width*height},(_,i)=>i%97===0?0:1)});
  const target=make(size,size,(x,y)=>2.4*signal(x-dx,y-dy)+.3),reference=make(size+2*margin,size+2*margin,(x,y)=>signal(x-margin,y-margin));
  const result=matchImageFeatures(target,reference,margin,policy);
  assert.ok(Math.abs(result.offsetPixels[0]-dx)<.1&&Math.abs(result.offsetPixels[1]-dy)<.1);
  for(const partition of ['fit','holdout'])assert.ok(result.matches.filter(m=>m.partition===partition).length>=6);
  assert.ok(result.matches.every(m=>Math.hypot(m.sourcePixel[0]-m.seedPixel[0]-dx,m.sourcePixel[1]-m.seedPixel[1]-dy)<.25));
});
test('flat patches cannot supply a camera and overlapping control cells are rejected',()=>{
  const target={width:104,height:104,values:new Float32Array(104**2).fill(2),valid:new Uint8Array(104**2).fill(1)},reference={width:140,height:140,values:new Float32Array(140**2).fill(2),valid:new Uint8Array(140**2).fill(1)};
  assert.throws(()=>matchImageFeatures(target,reference,18,policy),/Insufficient/);
  assert.throws(()=>matchImageFeatures(target,reference,18,{...policy,gridStride:8}),/policy/);
});
test('changing radiance units preserves the fitted translation and independent controls',()=>{
  const size=104,margin=18,dx=4,dy=-3;
  const signal=(x:number,y:number)=>3+Math.sin(x*.81+y*.43)+Math.cos(x*.21-y*.69)+Math.sin(x*.07*y*.09);
  const make=(width:number,height:number,pixel:(x:number,y:number)=>number):MatchRaster=>({width,height,values:Float64Array.from({length:width*height},(_,i)=>pixel(i%width,Math.floor(i/width))),valid:new Uint8Array(width*height).fill(1)});
  const target=make(size,size,(x,y)=>2.4*signal(x-dx,y-dy)+.3),reference=make(size+2*margin,size+2*margin,(x,y)=>signal(x-margin,y-margin));
  const baseline=matchImageFeatures(target,reference,margin,policy);
  for(const [a,b] of [[1e-8,1e-7],[1e8,1e7],[1e-8,1e7]]){
    const converted=matchImageFeatures({...target,values:Float64Array.from(target.values,n=>n*a)},{...reference,values:Float64Array.from(reference.values,n=>n*b)},margin,policy);
    assert.deepEqual(converted.matches.map(m=>[m.id,m.partition,m.seedPixel]),baseline.matches.map(m=>[m.id,m.partition,m.seedPixel]));
    assert.deepEqual(converted.excluded.map(m=>[m.id,m.reason]),baseline.excluded.map(m=>[m.id,m.reason]));
    for(const [i,value] of converted.offsetPixels.entries())assert.ok(Math.abs(value-baseline.offsetPixels[i])<1e-9);
  }
  for(const level of [2e-8,2,2e8]){
    assert.throws(()=>matchImageFeatures({...target,values:new Float64Array(size**2).fill(level)},{...reference,values:new Float64Array((size+2*margin)**2).fill(level)},margin,policy),/Insufficient/);
  }
});
