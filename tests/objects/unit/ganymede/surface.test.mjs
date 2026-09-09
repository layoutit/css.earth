import assert from 'node:assert/strict';
import {test} from 'node:test';
import {fromFile} from 'geotiff';
import {createSourceManifest} from '../../../../src/platform/source-manifest.mjs';
import {publishedObservation,canonicalPoint,expectedMonochromeTexel,assertDisplayClose,countInteriorPixels} from '../observed-atlas-proof.mjs';
const sourceRoot=new URL('../../../../src/planets/ganymede/source/',import.meta.url);
const source=await createSourceManifest({planetId:'ganymede',planetName:'Ganymede',sourceRoot:sourceRoot.pathname});
let normal,enhanced;
async function observations(){normal??=await publishedObservation('ganymede','normal');enhanced??=await publishedObservation('ganymede','enhanced');}

test('source maps retain georeference and valid observed terrain',async()=>{
 await source.verify();await observations();
 const anchors={normal:{origin:[-8270555.6754185,4135277.8377093],resolution:[1000.0671917072,-1000.0671917072]},
  enhanced:{origin:[-8269755.621665,4134877.810833],resolution:[1435.72146209,-1435.72146209]}};
 for(const entry of source.inputsFor('surfaces')){
  const tiff=await fromFile(new URL(entry.path,sourceRoot).pathname);
  try{const image=await tiff.getImage(),expected=anchors[entry.lensId];assert.equal(image.getGDALNoData(),0);
   assert.equal(image.getGeoKeys().ProjCenterLongGeoKey,180);
   assert.deepEqual(image.getOrigin().slice(0,2),expected.origin);assert.deepEqual(image.getResolution().slice(0,2),expected.resolution);
   assert.deepEqual((entry.lensId==='normal'?normal:enhanced).record.sourceGeoreference.origin.slice(0,2),expected.origin);
   if(entry.lensId==='normal')for(const [x,y]of [[1500,1500],[4000,2048],[6000,2000],[7200,2800]]){
    const p=canonicalPoint(x,y,8192,4096),actual=normal.sample(p.longitude,p.latitude);
    const value=await expectedMonochromeTexel(image,entry,normal.record.layout,actual);
    assertDisplayClose(actual.rgb,[value,value,value],`native source-window anchor ${x},${y}`);
   }
  }finally{await tiff.close();}
 }
 assert.equal(normal.record.layout.width,8192);assert.equal(normal.record.layout.height,4096);
});

test('enhanced color preserves monochrome across synthesized and missing source coverage',async()=>{
 await observations();
 // 230 W = 130 E is inside the independently documented synthesized-red sector.
 const x=Math.floor(130/360*8192);
 for(const y of [300,1200,2048,3200,3800]){
  const p=canonicalPoint(x,y,8192,4096);
  assertDisplayClose(enhanced.sample(p.longitude,p.latitude).rgb,normal.sample(p.longitude,p.latitude).rgb,'Source-synthesized red retains observed monochrome');
 }
 assert.ok(countInteriorPixels(enhanced,(r,g,b)=>Math.max(r,g,b)-Math.min(r,g,b)>12)>8192*4096/4,'The actual runtime atlas retains real color outside withheld coverage');
 assert.ok(enhanced.record.withheldSyntheticPixels>0);assert.ok(enhanced.record.monochromePixels>8192*4096/10);
 for(const surface of [normal,enhanced]){
  assert.equal(surface.record.layout.gutter,64);assert.equal(surface.poles.info.width,2048);assert.equal(surface.poles.info.height,1024);
 }
});
