import assert from 'node:assert/strict';import{test}from'node:test';
import{observationPixelMissing,prepareFloatObservation,prepareRgbBandObservation}from'./observed-geotiff.mts';
import { writeArrayBuffer, type GeotiffWriterMetadata } from 'geotiff';
import { mkdtemp, writeFile, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

test('16-bit color bands preserve RGB identity, alpha validity, dark samples and map registration', async () => {
 const dir=await mkdtemp(join(tmpdir(),'cssearth-rgb-bands-'));
 try {
  const path=join(dir,'bands.tif'), radius=180/Math.PI;
  const values=Uint16Array.from([65535,0,32768,65535, 0,65535,0,65535, 1,0,0,65535, 65535,65535,65535,32768,
    0,0,0,65535, 2570,5140,7710,65535, 5140,7710,10280,65535, 7710,10280,12850,65535]);
  await writeFile(path,Buffer.from(writeArrayBuffer(values,{width:4,height:2,SamplesPerPixel:4,
   BitsPerSample:[16,16,16,16],SampleFormat:[1,1,1,1],PhotometricInterpretation:1,GDAL_NODATA:'0',
   ModelPixelScale:[90,90,0],ModelTiepoint:[0,0,0,-180,90,0],GeoDoubleParams:[radius],
   GeoKeyDirectory:[1,1,0,7, 1025,0,1,1, 2057,34736,1,0, 2058,34736,1,0,
    3075,0,1,17, 3078,0,1,0, 3088,0,1,180, 3089,0,1,0]})));
  const entry={id:'test-rgb',width:4,height:2,projection:{referenceRadiusMeters:radius}};
  const policy={kind:'geotiff-rgb-bands',samples:[0,1,2],alphaBand:3,sampleBytes:2,noData:0,centerLongitude:180,
   resolutionMeters:90,origin:[-180,90],grid:{pixelsPerDegree:1/90,sampleOffset:1.5,lineOffset:.5}};
  const result=await prepareRgbBandObservation(path,entry,policy,4,2);
  assert.deepEqual([...result.rgb.subarray(0,9)],[255,0,128,0,255,0,0,0,0]);
  assert.equal(result.missing[2],0,'Validity precedes the display conversion that rounds a dark sample to zero');
  assert.equal(result.missing[3],1,'Partial source alpha cannot become observed coverage');
  assert.equal(result.missing[4],1,'All-channel source fill is omitted');
  assert.deepEqual([...result.rgb.subarray(15)],[10,20,30,20,30,40,30,40,50]);
  await assert.rejects(prepareRgbBandObservation(path,entry,{...policy,origin:[-90,90]},4,2),/grid changed/);
 }finally{await rm(dir,{recursive:true,force:true})}
});

test('geographic 64-bit reflectance respects longitude, latitude, zero and missing values', async () => {
 const dir = await mkdtemp(join(tmpdir(), 'cssearth-geographic-'));
 try {
  const path = join(dir, 'map.tif');
  const values = Float64Array.from([0,.1,.2,.3,.4, .4,.5,.6,-1,.8, .7,.8,.9,-1,1]);
  const geographicMetadata: GeotiffWriterMetadata & {
    GeogAngularUnitsGeoKey: number;
    GeogSemiMajorAxisGeoKey: number;
  } = { width:5, height:3,
   BitsPerSample:[64], SampleFormat:[3], GDAL_NODATA:'-1', ModelPixelScale:[90,90,0],
   ModelTiepoint:[0,0,0,0,90,0], GTModelTypeGeoKey:2, GeographicTypeGeoKey:32767,
   GeogAngularUnitsGeoKey:9102, GeogSemiMajorAxisGeoKey:448 };
  await writeFile(path, Buffer.from(writeArrayBuffer(values, geographicMetadata)));
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
