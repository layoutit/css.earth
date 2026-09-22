import assert from 'node:assert/strict';
import { sourceTest } from './source-test.mts';
const test = sourceTest();
import {readFile} from 'node:fs/promises';
import {parseObservedPolarRecipe,prepareObservedPolarSurfaces,measureRgbCoverage} from '../../tools/objects/giant-observations/index.mts';
import {measureScalarCoverage,finitePercentiles,falseColorMap} from '../../tools/objects/giant-observations/scalar-coverage.mts';
import {preparePolarContinuationAtlas,preparePolarSurfaceTransition} from '../../tools/objects/giant-observations/polar-continuation.mts';
const sourceDirectory=new URL('../../src/objects/jupiter/source/',import.meta.url).pathname;
const recipe=JSON.parse(await readFile(sourceDirectory+'/preparation/observations.json','utf8'));

test('RGB coverage is measured and checked against authored row bounds',()=>{
 const source={data:Buffer.alloc(8*6*3),info:{width:8,height:6,channels:3}};
 source.data.fill(100,8*3,8*5*3);
 assert.deepEqual(measureRgbCoverage(source,{columnStride:2,minimumMean:3,firstMeasuredRow:1,lastMeasuredRow:4}),{firstMeasuredRow:1,lastMeasuredRow:4});
 assert.throws(()=>Reflect.apply(measureRgbCoverage,undefined,[source,{columnStride:0,minimumMean:3}]),/sampling/);
 assert.throws(()=>measureRgbCoverage(source,{columnStride:2,minimumMean:3,firstMeasuredRow:0,lastMeasuredRow:4}),/changed/);
});

test('scalar coverage retains observed values and leaves missing samples unavailable',()=>{
 const source={width:8,height:10,values:new Float32Array(80).fill(NaN)};
 for(let row=2;row<=7;row++)for(let col=0;col<8;col++)source.values[row*8+col]=col+1;
 source.values[4*8+3]=NaN;
 const measured=measureScalarCoverage(source,{noData:0,coverage:'polar-connected-zero'});
 assert.equal(measured.firstMeasuredRow,2);assert.equal(measured.lastMeasuredRow,7);
 assert.equal(measured.missing[4*8+3],1);assert.ok(Number.isNaN(measured.values[4*8+3]));
 assert.equal(measured.values[4*8+2],3);assert.equal(measured.sourceMissingPixels,33);
 assert.deepEqual(finitePercentiles([1,2,3,4,NaN],0,1,.5),[1,4]);
 assert.throws(()=>finitePercentiles([1,2],1,0,.5),/bounds/);
});

test('false color uses declared palette and square-root display stretch',()=>{
 const rgba=falseColorMap({width:3,height:1,values:[1,2,5]},[[0,0,0],[100,200,240]],1,5);
 assert.deepEqual([...rgba],[0,0,0,255,50,100,120,255,100,200,240,255]);
});

test('measured polar harmonic continuation is bounded and leaves untransitioned rows intact',()=>{
 const source={data:Buffer.alloc(64*32*3,80),info:{width:64,height:32,channels:3}};
 const polar=preparePolarContinuationAtlas({source,tileSize:16,firstMeasuredRow:4,lastMeasuredRow:27,measuredHeight:32});
 assert.equal(polar.width,32);assert.equal(polar.height,16);assert.ok(polar.transparentPixelRatio>0);
 assert.ok(polar.data.some((value,index)=>index%4===3&&value===0));assert.ok(polar.data.some((value,index)=>index%4===3&&value===255));
 assert.deepEqual(preparePolarSurfaceTransition({source,polarDetails:{}}).data,source.data);
 assert.throws(()=>preparePolarContinuationAtlas({source,tileSize:8,firstMeasuredRow:4,lastMeasuredRow:27,measuredHeight:32}),/invalid/);
});

