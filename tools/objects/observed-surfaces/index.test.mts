import { fixtureRecord } from '../../contract/test-values.mts';
import { requireArray } from '../../sources/source-values.mts';
import assert from 'node:assert/strict';
import { sourceTest } from '../../../tests/objects/source-test.mts';
const test = sourceTest();
import {createHash} from 'node:crypto';
import {readFile,mkdtemp,readdir,rm,writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import sharp from 'sharp';
import {continueBoundaryMean,percentileFalseColor,completeUniformCoverage,polarDiscAtlas,parseObservedSurfaceRecipe,prepareObservedSurfaces} from './index.mts';
import type {PolarProjection} from './contract.mts';

test('boundary continuation retains observed rows and varies only source-derived longitude',()=>{
  const input=new Float32Array([0,0,0,0,2,6,10,12,14,16,18,20]);
  const result=continueBoundaryMean(input,{width:2,height:6,channels:1,boundaryFraction:1/3,exponent:3,minimumBoundarySum:0});
  assert.deepEqual([...result.slice(0,4)],[4,4,3.75,4.25]);assert.deepEqual(result.slice(4),input.slice(4));assert.equal(input[0],0);
  assert.throws(()=>continueBoundaryMean(new Float32Array(12),{width:2,height:6,channels:1,boundaryFraction:1/3,exponent:3,minimumBoundarySum:0}),/not fully observed/);
});
test('scalar mapping carries explicit missingness and declared false colour',()=>{
  const result=percentileFalseColor(new Float32Array([NaN,1,2,3,4,5]),3,2,{percentiles:[0,0.8],minimumCoverage:0.5,positiveValidity:true,channels:4,transfer:'sqrt',exponent:0.5,palette:[[0,0,0],[0,100,0],[200,200,200]]});
  assert.deepEqual(result.stretch,[1,5]);assert.equal(result.data[3],0);assert.deepEqual([...result.data.slice(-4)],[200,200,200,255]);
});
test('unobserved hemisphere uses a bounded scientific baseline without new local features',()=>{
  const data=Buffer.alloc(4*10*4);for(let i=0;i<4*5;i++)data.set([30+i,50,70,255],i*4);
  const result=completeUniformCoverage({data,width:4,height:10,channels:4},{color:[10,20,30],provenance:{authority:'hypothetical pinned observation',model:'central-disc mean'}},{kind:'uniform-baseline',minimumBrightness:0,minimumCoverage:0.5,alphaValidity:true,minimumRowCoverage:0.5,equatorialInsetRows:0,allowedBoundaryRange:[0.25,0.75],transitionRows:2});
  assert.equal(result.coverage.lastObservedRow,4);assert.equal(result.coverage.filledPixelCount,20);
  for(let i=20;i<40;i++)assert.deepEqual([...result.data.slice(i*4,i*4+4)],[10,20,30,255]);
});
test('polar projection uses explicit pole count, sampling and RGBA coverage',()=>{
  const map={data:Buffer.from(Array.from({length:32},(_,i)=>[i,100,200,255]).flat()),width:8,height:4,channels:4 as const};
  const atlas=polarDiscAtlas(map,{tileSize:8,poles:['north','south'],latitudeSegments:20,angularMode:'direct-segment',sampling:'nearest-closed'});
  assert.equal(atlas.width,16);assert.equal(atlas.height,8);assert.equal(atlas.data[3],0);assert.equal(atlas.data[(3*16+3)*4+3],255);
});
test('pole products bypass coordinate-preserving lens resizes while retained maps keep their declared size',async()=>{
  const directory=await mkdtemp(join(tmpdir(),'observation-native-poles-'));
  try{
    const source=Buffer.from([10,20,30,40,50,60,70,80,90,100,110,120,130,140,150,160,170,180,190,200,210,220,230,240]);
    const bytes=await sharp(source,{raw:{width:4,height:2,channels:3}}).png().toBuffer(),path='map.png';
    await writeFile(join(directory,path),bytes);
    const projection: PolarProjection={tileSize:4,poles:['north','south'],latitudeSegments:20,angularMode:'direct-segment',sampling:'bilinear-wrapped'};
    const result=await prepareObservedSurfaces({sourceDirectory:directory,config:{schema:'cssearth-observed-surfaces@1',sources:[{path}],lenses:[{id:'normal',source:path,decode:{kind:'raster',channels:3},transforms:[{kind:'resize',width:16,height:8}],products:[{kind:'poles',filename:'normal-poles.webp',projection,encoding:{lossless:true}}]}]}});
    assert.deepEqual(result.maps.get('normal')?.width,16);assert.deepEqual(result.maps.get('normal')?.height,8);
    const encoded=result.assets[0],decoded=await sharp(encoded.data).raw().toBuffer({resolveWithObject:true}),expected=polarDiscAtlas({data:source,width:4,height:2,channels:3},projection);
    assert.deepEqual({width:decoded.info.width,height:decoded.info.height,channels:decoded.info.channels,size:decoded.info.size},{width:expected.width,height:expected.height,channels:4,size:expected.data.length});
    assert.deepEqual(decoded.data,expected.data);
  }finally{await rm(directory,{recursive:true,force:true});}
});
test('recipe and source failures are rejected before output writes',async()=>{
  const config=JSON.parse(await readFile(new URL('../../../src/objects/neptune/source/preparation/observations.json',import.meta.url),'utf8'));
  for(const mutate of[
 (c: unknown)=>fixtureRecord(c,'lenses',0,'products',0).filename='../escape.webp',
 (c: unknown)=>requireArray(requireArray(fixtureRecord(c,'lenses',1,'decode','color').palette)[0])[0]=Infinity,
 (c: unknown)=>fixtureRecord(c,'lenses',0,'coverage').kind='invented-pixels',
 (c: unknown)=>{const products=requireArray(fixtureRecord(c,'lenses',0).products);products.push(products[0]);}
]){const copy=structuredClone(config);mutate(copy);assert.throws(()=>parseObservedSurfaceRecipe(copy));}
});
