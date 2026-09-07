import assert from 'node:assert/strict';
import test from 'node:test';
import {readFile} from 'node:fs/promises';
import {parseObservedPolarRecipe,prepareObservedPolarSurfaces,measureRgbCoverage} from '../../tools/objects/giant-observations/index.mjs';
import {completeScalarCoverage,finitePercentiles,falseColorMap} from '../../tools/objects/giant-observations/scalar-coverage.mjs';
import {preparePolarContinuationAtlas,preparePolarSurfaceTransition} from '../../tools/objects/giant-observations/polar-continuation.mjs';
const sourceDirectory=new URL('../../src/planets/jupiter/source/',import.meta.url).pathname;
const recipe=JSON.parse(await readFile(sourceDirectory+'/preparation/observations.json','utf8'));

test('RGB coverage is measured and checked against authored row bounds',()=>{
 const source={data:Buffer.alloc(8*6*3),info:{width:8,height:6,channels:3}};
 source.data.fill(100,8*3,8*5*3);
 assert.deepEqual(measureRgbCoverage(source,{columnStride:2,minimumMean:3,firstMeasuredRow:1,lastMeasuredRow:4}),{firstMeasuredRow:1,lastMeasuredRow:4});
 assert.throws(()=>measureRgbCoverage(source,{columnStride:0,minimumMean:3}),/sampling/);
 assert.throws(()=>measureRgbCoverage(source,{columnStride:2,minimumMean:3,firstMeasuredRow:0,lastMeasuredRow:4}),/changed/);
});

test('scalar polar coverage keeps Float32 arithmetic and circular longitude repair',()=>{
 const source={width:8,height:10,values:new Float32Array(80).fill(NaN)};
 for(let row=2;row<=7;row++)for(let col=0;col<8;col++)source.values[row*8+col]=col+1;
 source.values[4*8+3]=NaN;
 const complete=completeScalarCoverage(source,{lookbackDegrees:.5,convergenceExponent:2,edgeTransitionRows:2});
 assert.equal(complete.firstMeasuredRow,2);assert.equal(complete.lastMeasuredRow,7);assert.equal(complete.values[4*8+3],4);
 assert.ok(complete.values instanceof Float32Array);assert.ok([...complete.values].every(Number.isFinite));assert.ok(Number.isNaN(source.values[0]));
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

test('observation routing uses capabilities and rejects unsafe or unpinned inputs',async()=>{
 assert.equal(parseObservedPolarRecipe(recipe),recipe);
 const synthetic=structuredClone(recipe);synthetic.namespace='synthetic';synthetic.publicPrefix='/scenes/synthetic/';assert.equal(parseObservedPolarRecipe(synthetic),synthetic);
 for(const mutate of [value=>value.lenses[0].operation='jupiter',value=>value.lenses[0].source='../other',value=>value.sourcePins=[],value=>value.lenses[0].coverage.columnStride=0,value=>value.dimensions.width=Infinity]){const invalid=structuredClone(recipe);mutate(invalid);assert.throws(()=>parseObservedPolarRecipe(invalid));}
 const changed=structuredClone(recipe);changed.sourcePins[0].expectedSha256='0'.repeat(64);
 await assert.rejects(prepareObservedPolarSurfaces({sourceDirectory,publicDirectory:'/unused',config:changed}),/pin mismatch/);
});
