import { pathToFileURL } from 'node:url';
import { projectRoot as findProjectRoot } from '@cssearth/core/node';
import { fixtureRecord } from '@cssearth/objects/node/contract';
import { requireArray } from '@cssearth/core';
import assert from 'node:assert/strict';
import { sourceTest } from '@cssearth/objects/node/source-test';
const test = sourceTest();
import {readFile,mkdtemp,readdir,rm,writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import sharp from 'sharp';
import {continueBoundaryMean,percentileFalseColor,completeUniformCoverage,polarDiscAtlas,parseObservedSurfaceRecipe,prepareObservedSurfaces} from '@cssearth/bake/objects/layers/observed-surfaces';
import type {PolarProjection} from '@cssearth/bake/objects/layers/observed-surfaces';
import {card} from '@cssearth/fits/test-support';

test('dated component coverage normalizes longitude and preserves isolated dark observations',async()=>{
  const directory=await mkdtemp(join(tmpdir(),'opal-components-'));
  try{
    const width=5,height=8,rgb=Buffer.from(Array.from({length:width*height},(_,i)=>[10+(i%4)*30,60,90]).flat());
    await sharp(rgb,{raw:{width,height,channels:3}}).png().toFile(join(directory,'map.png'));
    for(let channel=0;channel<3;channel++){
      const values=new Float32Array(width*height).fill(1);
      values[2*width+2]=0; // an isolated measured zero
      values.fill(0,4*width,5*width);values[3*width+3]=0; // ring occlusion extends beyond the full row
      if(channel===1)values[width+1]=NaN;
      const header=Buffer.from([card('SIMPLE','T'),card('BITPIX','-32'),card('NAXIS','2'),card('NAXIS1',String(width)),card('NAXIS2',String(height)),'END'.padEnd(80)].join('').padEnd(2880));
      const data=Buffer.alloc(2880);values.forEach((value,i)=>data.writeFloatBE(value,i*4));
      await writeFile(join(directory,`${channel}.fits`),Buffer.concat([header,data]));
    }
    const result=await prepareObservedSurfaces({sourceDirectory:directory,config:{schema:'cssearth-observed-surfaces@2',sources:['map.png','0.fits','1.fits','2.fits'].map(path=>({path})),datasets:[{id:'dated',source:'map.png',decode:{kind:'raster',channels:3},coverage:{kind:'component-fits',sources:['0.fits','1.fits','2.fits'],unobservedRows:[[4,4]],reverseLongitude:true,longitudeOffsetDegrees:0,longitudePeriod:4},products:[{kind:'thumbnail',filename:'dated.webp',transforms:[{kind:'resize',width:10,height:16}],encoding:{lossless:true}}]}]}});
    const map=result.maps.get('dated');assert.ok(map);
    assert.deepEqual([0,1,2,3].map(x=>map.data[x*4]),[10,100,70,40]);
    assert.equal(map.missing?.[width+3],1); // missing green component survives reversal
    assert.equal(map.missing?.[2*width+2],0); // isolated dark sample stays measured
    assert.equal(map.missing?.[3*width+1],1); // connected ring gap survives reversal
    assert.ok(map.missing?.slice(4*width,5*width).every(value=>value===1));
    assert.equal(result.assets.length,1);
  }finally{await rm(directory,{recursive:true,force:true});}
});

test('a color cube with declared rows reads its first row as stated, reverses longitude and moves sample rows to mesh latitude',async()=>{
  const directory=await mkdtemp(join(tmpdir(),'fits-planes-'));
  try{
    // 5 samples of longitude with the end meridian repeated, 5 sample rows from pole to pole, stored north first
    const width=5,height=5,value=(plane: number,y: number,x: number)=>plane===0?(x===0?250:10*(x%4)+y):plane===1?100+y:200;
    const header=Buffer.from([card('SIMPLE','T'),card('BITPIX','-32'),card('NAXIS','3'),card('NAXIS1',String(width)),card('NAXIS2',String(height)),card('NAXIS3','3'),'END'.padEnd(80)].join('').padEnd(2880));
    const data=Buffer.alloc(2880);for(let plane=0;plane<3;plane++)for(let y=0;y<height;y++)for(let x=0;x<width;x++)data.writeFloatBE(value(plane,y,x),(plane*width*height+y*width+x)*4);
    await writeFile(join(directory,'cube.fits'),Buffer.concat([header,data]));
    const dataset=(extra: object)=>({id:'cube',source:'cube.fits',decode:{kind:'fits-planes',bitpix:-32,width,height,firstRow:'north'},coverage:{kind:'declared-rows',unobservedRows:[[2,2]],reverseLongitude:true,longitudeOffsetDegrees:0,longitudePeriod:4},products:[{kind:'thumbnail',filename:'cube.webp',encoding:{lossless:true}}],...extra});
    const prepare=(extra: object={})=>prepareObservedSurfaces({sourceDirectory:directory,config:{schema:'cssearth-observed-surfaces@2',sources:[{path:'cube.fits'}],datasets:[dataset(extra)]}});
    const map=(await prepare()).maps.get('cube');assert.ok(map);
    assert.deepEqual([map.width,map.height],[5,5]);
    assert.deepEqual([0,1,2,3,4].map(x=>map.data[x*4]),[250,30,20,10,250]); // column x shows stored column 4 - x of the 4-sample period
    assert.deepEqual([...map.data.slice((4*5+1)*4,(4*5+1)*4+4)],[34,104,200,255]); // the last stored row is the south pole
    // A file whose first column holds no map: cropped away, and the offset of one sample brings the end meridian to column 0.
    const cropped=(await prepare({decode:{kind:'fits-planes',bitpix:-32,width,height,firstRow:'north',crop:{left:1,top:0,width:4,height:5}},coverage:{kind:'declared-rows',unobservedRows:[[2,2]],reverseLongitude:true,longitudeOffsetDegrees:-90,longitudePeriod:4}})).maps.get('cube');
    assert.deepEqual([cropped?.width,[0,1,2,3].map(x=>cropped?.data[x*4])],[4,[0,30,20,10]]);
    assert.ok(map.missing?.slice(2*5,3*5).every(missing=>missing===1));assert.equal(map.missing?.[5],0);
    const south=(await prepare({decode:{kind:'fits-planes',bitpix:-32,width,height,firstRow:'south'}})).maps.get('cube');
    assert.equal(south?.data[1],104); // read south first, the same bytes put stored row 4 at the top
    const mesh=(await prepare({planetocentricSampleRows:1})).maps.get('cube');assert.ok(mesh);
    assert.deepEqual([mesh.width,mesh.height],[5,4]);
    assert.equal(mesh.data[1],101); // on a sphere a mesh row lies midway between two sample rows: (100 + 101) / 2, rounded
    assert.deepEqual([...mesh.missing!.slice(0,20)].filter((_,i)=>i%5===0),[0,1,1,0]); // rows that touch the declared row are missing
    await writeFile(join(directory,'cube.fits'),Buffer.concat([header,Buffer.from(data).fill(0x43,0,4)])); // 0x43434343 is 195.26, not a display value
    await assert.rejects(prepare(),/8-bit display values/);
    assert.throws(()=>parseObservedSurfaceRecipe({schema:'cssearth-observed-surfaces@2',sources:[{path:'cube.fits'}],datasets:[dataset({decode:{kind:'fits-planes',bitpix:-32,width,height,firstRow:'north',crop:{left:2,top:0,width:4,height:5}}})]}),/FITS plane geometry/);
  }finally{await rm(directory,{recursive:true,force:true});}
});

test('boundary continuation retains observed rows and varies only source-derived longitude',()=>{
  const input=new Float32Array([0,0,0,0,2,6,10,12,14,16,18,20]);
  const result=continueBoundaryMean(input,{width:2,height:6,channels:1,boundaryFraction:1/3,exponent:3,minimumBoundarySum:0});
  assert.deepEqual([...result.slice(0,4)],[4,4,3.75,4.25]);assert.deepEqual(result.slice(4),input.slice(4));assert.equal(input[0],0);
  assert.throws(()=>continueBoundaryMean(new Float32Array(12),{width:2,height:6,channels:1,boundaryFraction:1/3,exponent:3,minimumBoundarySum:0}),/not fully observed/);
});
test('scalar mapping carries explicit missingness and declared false color',()=>{
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
test('pole products bypass coordinate-preserving dataset resizes while retained maps keep their declared size',async()=>{
  const directory=await mkdtemp(join(tmpdir(),'observation-native-poles-'));
  try{
    const source=Buffer.from([10,20,30,40,50,60,70,80,90,100,110,120,130,140,150,160,170,180,190,200,210,220,230,240]);
    const bytes=await sharp(source,{raw:{width:4,height:2,channels:3}}).png().toBuffer(),path='map.png';
    await writeFile(join(directory,path),bytes);
    const projection: PolarProjection={tileSize:4,poles:['north','south'],latitudeSegments:20,angularMode:'direct-segment',sampling:'bilinear-wrapped'};
    const result=await prepareObservedSurfaces({sourceDirectory:directory,config:{schema:'cssearth-observed-surfaces@2',sources:[{path}],datasets:[{id:'normal',source:path,decode:{kind:'raster',channels:3},transforms:[{kind:'resize',width:16,height:8}],products:[{kind:'poles',filename:'normal-poles.webp',projection,encoding:{lossless:true}}]}]}});
    assert.deepEqual(result.maps.get('normal')?.width,16);assert.deepEqual(result.maps.get('normal')?.height,8);
    const encoded=result.assets[0],decoded=await sharp(encoded.data).raw().toBuffer({resolveWithObject:true}),expected=polarDiscAtlas({data:source,width:4,height:2,channels:3},projection);
    assert.deepEqual({width:decoded.info.width,height:decoded.info.height,channels:decoded.info.channels,size:decoded.info.size},{width:expected.width,height:expected.height,channels:4,size:expected.data.length});
    assert.deepEqual(decoded.data,expected.data);
  }finally{await rm(directory,{recursive:true,force:true});}
});
test('recipe and source failures are rejected before output writes',async()=>{
  const config=JSON.parse(await readFile(new URL('src/objects/neptune/source/preparation/observations.json', pathToFileURL(findProjectRoot(import.meta.url) + '/')),'utf8'));
  for(const mutate of[
 (c: unknown)=>fixtureRecord(c,'datasets',0,'products',0).filename='../escape.webp',
 (c: unknown)=>requireArray(requireArray(fixtureRecord(c,'datasets',1,'decode','color').palette)[0])[0]=Infinity,
 (c: unknown)=>fixtureRecord(c,'datasets',0,'coverage').kind='invented-pixels',
 (c: unknown)=>{const products=requireArray(fixtureRecord(c,'datasets',0).products);products.push(products[0]);}
]){const copy=structuredClone(config);mutate(copy);assert.throws(()=>parseObservedSurfaceRecipe(copy));}
});
