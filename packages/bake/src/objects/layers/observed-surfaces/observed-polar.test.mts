import { pathToFileURL } from 'node:url';
import { projectRoot as findProjectRoot } from '@cssearth/core/node';
import assert from 'node:assert/strict';
import { sourceTest } from '@cssearth/objects/node/source-test';
const test = sourceTest();
import {readFile,mkdtemp,writeFile,rm} from 'node:fs/promises';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import sharp from 'sharp';
import {imageFixture} from '../../geometry/fixtures/fits-helpers.mts';
import {parseObservedPolarRecipe,prepareObservedPolarSurfaces,measureRgbCoverage} from '@cssearth/bake/objects/layers/giant';
import {measureScalarCoverage,finitePercentiles,falseColorMap} from '@cssearth/bake/objects/layers/observed-surfaces';
import {preparePolarContinuationAtlas,preparePolarSurfaceTransition} from '@cssearth/bake/objects/layers/giant';
const sourceDirectory=new URL('src/objects/jupiter/source/', pathToFileURL(findProjectRoot(import.meta.url) + '/')).pathname;
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

test('signed model fields retain zero at the poles and keep a neutral linear midpoint',()=>{
 const source={width:2,height:2,values:new Float32Array([0,-2,2,NaN])};
 const measured=measureScalarCoverage(source,{noData:0,coverage:'finite'});
 assert.deepEqual([...measured.missing],[0,0,0,1]);
 const rgba=falseColorMap(measured,[[0,0,255],[255,255,255],[255,0,0]],-2,2,1);
 assert.deepEqual([...rgba.subarray(0,4)],[255,255,255,255]);
 assert.deepEqual([...rgba.subarray(4,8)],[0,0,255,255]);
 assert.deepEqual([...rgba.subarray(12)],[0,0,0,0]);
 assert.throws(()=>falseColorMap(source,[[0,0,0],[255,255,255]],-2,2,0),/gamma/);
});

test('dated RGB maps intersect all component footprints and preserve the shared date control',async()=>{
 const root=await mkdtemp(join(tmpdir(),'observed-rgb-'));
 try{
  await sharp(Buffer.alloc(2*16*3,120),{raw:{width:2,height:16,channels:3}}).tiff().toFile(join(root,'rgb.tif'));
  for(let band=0;band<3;band++){
   const values=new Array<number>(32).fill(1);values[0]=values[1]=values[30]=values[31]=0;
   values[12]=0; // dark interior observations remain valid
   if(band===1)values[16]=NaN;
   await writeFile(join(root,band+'.fits'),imageFixture(-32,values));
  }
  const config=structuredClone(recipe), dataset=structuredClone(config.datasets.find((entry:{operation:string})=>entry.operation==='rgb-observed-gaps'));
  dataset.source='rgb.tif';dataset.coverageSources=['0.fits','1.fits','2.fits'];dataset.planetographicAxisRatio=1;
  config.datasets=[dataset];config.dimensions={width:32,height:16,polarTileSize:16};
  config.packing={latitudeBoundsDegrees:[-80,-40,0,40,80],gutter:2};
  const result=await prepareObservedPolarSurfaces({sourceDirectory:root,publicDirectory:root,config});
  assert.equal(result.coverage[dataset.id].sourceMissingPixels,5);
  assert.equal(result.coverage[dataset.id].firstMeasuredRow,1);assert.equal(result.coverage[dataset.id].lastMeasuredRow,14);
  assert.deepEqual(result.datasets.controls[0].step,dataset.control.step);
  assert.equal(result.assets.length,5);
 }finally{await rm(root,{recursive:true,force:true});}
});

test('measured polar harmonic continuation is bounded and leaves untransitioned rows intact',()=>{
 const source={data:Buffer.alloc(64*32*3,80),info:{width:64,height:32,channels:3}};
 const polar=preparePolarContinuationAtlas({source,tileSize:16,firstMeasuredRow:4,lastMeasuredRow:27,measuredHeight:32});
 assert.equal(polar.width,32);assert.equal(polar.height,16);assert.ok(polar.transparentPixelRatio>0);
 assert.ok(polar.data.some((value,index)=>index%4===3&&value===0));assert.ok(polar.data.some((value,index)=>index%4===3&&value===255));
 assert.deepEqual(preparePolarSurfaceTransition({source,polarDetails:{}}).data,source.data);
 assert.throws(()=>preparePolarContinuationAtlas({source,tileSize:8,firstMeasuredRow:4,lastMeasuredRow:27,measuredHeight:32}),/invalid/);
});
