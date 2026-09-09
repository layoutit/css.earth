import assert from 'node:assert/strict';import{test}from'node:test';
import{observationPixelMissing,prepareFloatObservation}from'./observed-geotiff.mjs';
import { writeArrayBuffer } from 'geotiff';
import { mkdtemp, writeFile, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

test('geographic 64-bit reflectance respects longitude, latitude, zero and missing values', async () => {
 const dir = await mkdtemp(join(tmpdir(), 'cssearth-geographic-'));
 try {
  const path = join(dir, 'map.tif');
  const values = Float64Array.from([0,.1,.2,.3,.4, .4,.5,.6,-1,.8, .7,.8,.9,-1,1]);
  await writeFile(path, Buffer.from(writeArrayBuffer(values, { width:5, height:3,
   BitsPerSample:[64], SampleFormat:[3], GDAL_NODATA:'-1', ModelPixelScale:[90,90,0],
   ModelTiepoint:[0,0,0,0,90,0], GTModelTypeGeoKey:2, GeographicTypeGeoKey:32767,
   GeogAngularUnitsGeoKey:9102, GeogSemiMajorAxisGeoKey:448 })));
  const entry = {id:'analytic-reflectance', width:5, height:3, projection:{referenceRadiusMeters:448}};
  const policy = {kind:'geotiff-float-monochrome', sampleBytes:8, coordinates:'degrees',
   noData:-1, centerLongitude:0, resolutionDegrees:90, origin:[0,90], displayRange:[0,1],specialValueMagnitude:1e30};
  const {rgb,missing} = await prepareFloatObservation(path,entry,policy,4,2);
  assert.deepEqual([...missing], [0,0,1,1,0,0,1,1], 'A missing value invalidates its full interpolation footprint');
  assert.deepEqual([...rgb].filter((_,i)=>i%3===0),[0,26,0,0,102,128,0,0]);
  await assert.rejects(prepareFloatObservation(path,entry,{...policy,sampleBytes:4},4,2),/grid changed/);
  await assert.rejects(prepareFloatObservation(path,entry,{...policy,origin:[-180,90]},4,2),/grid changed/);
 } finally { await rm(dir,{recursive:true,force:true}); }
});
test('explicit source no-data distinguishes any-channel and complete-pixel masks',()=>{
 const base={noData:0,zeroValidity:'all-channels'};assert.equal(observationPixelMissing([1,1,1],0,0,base),false);
 assert.equal(observationPixelMissing([0,1,1],0,0,base),false);assert.equal(observationPixelMissing([0,0,0],0,0,base),true);
 assert.equal(observationPixelMissing([0,1,1],0,0,{...base,zeroValidity:'any-channel'}),true);
});
test('documented polar and synthetic-channel exclusions operate in source geographic coordinates',()=>{
 const p={noData:0,zeroValidity:'any-channel',withholdLatitudeDegrees:85,withholdLongitudeDegrees:[110,150]};
 assert.equal(observationPixelMissing([1,1,1],109.999,84.999,p),false);assert.equal(observationPixelMissing([1,1,1],110,0,p),true);
 assert.equal(observationPixelMissing([1,1,1],150,0,p),true);assert.equal(observationPixelMissing([1,1,1],151,-85,p),true);
});
