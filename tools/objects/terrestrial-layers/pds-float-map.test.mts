import assert from 'node:assert/strict';
import {test} from 'node:test';
import {gzipSync} from 'node:zlib';
import {mkdtemp,writeFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {resolve} from 'node:path';
import {decodePdsFloatImage,loadPdsFloatMap} from './pds-float-map.mts';
const grid={productId:'EXAMPLE_090',dataSetId:'EXAMPLE',targetName:'TITAN',width:2,height:2,pixelsPerDegree:1/90,referenceRadiusMeters:1000,centerLongitudeWestDegrees:180,sampleProjectionOffset:-0.5,lineProjectionOffset:0.5,projectionRotation:'NULL',missingBits:'FF7FFFFB',longitudeRangeWest:[0,180]};
function fixture(overrides={}) {
 const fields={PDS_VERSION_ID:'PDS3',RECORD_TYPE:'FIXED_LENGTH',RECORD_BYTES:8,FILE_RECORDS:514,'^IMAGE':513,PRODUCT_ID:'EXAMPLE_090',DATA_SET_ID:'EXAMPLE',TARGET_NAME:'TITAN',LINES:2,LINE_SAMPLES:2,SAMPLE_TYPE:'PC_REAL',SAMPLE_BITS:32,MISSING_CONSTANT:'16#FF7FFFFB#',SCALING_FACTOR:1,OFFSET:0,MAP_PROJECTION_TYPE:'EQUIRECTANGULAR',CENTER_LATITUDE:0,COORDINATE_SYSTEM_NAME:'PLANETOGRAPHIC',COORDINATE_SYSTEM_TYPE:'"BODY-FIXED ROTATING"',POSITIVE_LONGITUDE_DIRECTION:'WEST',MAP_PROJECTION_ROTATION:'NULL',A_AXIS_RADIUS:1,B_AXIS_RADIUS:1,C_AXIS_RADIUS:1,CENTER_LONGITUDE:180,SAMPLE_PROJECTION_OFFSET:-0.5,LINE_PROJECTION_OFFSET:0.5,MAP_RESOLUTION:1/90,MAXIMUM_LATITUDE:90,MINIMUM_LATITUDE:-90,EASTERNMOST_LONGITUDE:0,WESTERNMOST_LONGITUDE:180,...overrides};
 const bytes=Buffer.alloc(4112);bytes.write(Object.entries(fields).map(([k,v])=>`${k} = ${v}\n`).join('')+'END\n');
 [10,20,30,40].forEach((v,i)=>bytes.writeFloatLE(v,4096+i*4));bytes.writeUInt32LE(0xFF7FFFFB,4100);return bytes;
}
test('PDS floats preserve endian encoding and exact missing bits with the west-positive hemisphere placement',()=>{
 const r=decodePdsFloatImage(gzipSync(fixture()),grid);assert.deepEqual([...r.data],[10,NaN,30,40]);assert.equal(r.left,2);assert.equal(r.top,0);
 const invalid=fixture();invalid.writeFloatLE(Infinity,4096);assert.throws(()=>decodePdsFloatImage(invalid,grid),/Unexpected/);
 const other=decodePdsFloatImage(fixture({SAMPLE_PROJECTION_OFFSET:1.5}),{...grid,sampleProjectionOffset:1.5});assert.equal(other.left,0);
 for(const bytes of [fixture({SAMPLE_TYPE:'IEEE_REAL'}),fixture({A_AXIS_RADIUS:2}),fixture({POSITIVE_LONGITUDE_DIRECTION:'EAST'}),fixture({PRODUCT_ID:'OTHER'}),fixture({SCALING_FACTOR:1000}),fixture().subarray(0,-1)])assert.throws(()=>decodePdsFloatImage(bytes,grid),/differs/);
});
test('PDS sample support does not fill missing cells, cross hemispheres, or extrapolate past the pole',async()=>{
 const root=await mkdtemp(resolve(tmpdir(),'pds-float-fixture-'));
 try {
  await writeFile(resolve(root,'test.img'),fixture());const s=await loadPdsFloatMap(root,{path:'test.img',grid,valueTransform:{scale:0.001,offset:0}});
  assert.equal(s.sample(225,45),0.01);assert.equal(s.sample(-135,45),0.01);assert.equal(s.sample(315,45),null);
  assert.equal(s.sample(225,-45),0.03);assert.equal(s.sample(45,45),null);assert.equal(s.sample(225,-90),null);assert.equal(s.sample(225,91),null);
 } finally {await rm(root,{recursive:true,force:true});}
});
// A detached-label, big-endian, east-positive grid limited to ±30° latitude, like the Dawn VIR Ceres mosaics.
const eastGrid={productId:'EXAMPLE_EAST',dataSetId:'EXAMPLE',targetName:'1 CERES',width:12,height:2,pixelsPerDegree:1/30,referenceRadiusMeters:470000,
 centerLongitudeEastDegrees:180,longitudeRangeEast:[0,360],sampleProjectionOffset:5.5,lineProjectionOffset:0.5,projectionRotation:'0.0 <degree>',
 missingValue:-1e32,sampleType:'IEEE_REAL',coordinateSystem:'PLANETOCENTRIC',latitudeRange:[-30,30]};
function eastLabel(overrides={}) {
 const fields={PDS_VERSION_ID:'PDS3',DATA_SET_ID:'"EXAMPLE"',PRODUCT_ID:'"EXAMPLE_EAST"',RECORD_BYTES:48,FILE_RECORDS:3,RECORD_TYPE:'FIXED_LENGTH','^IMAGE':'"EAST.IMG"',TARGET_NAME:'"1 CERES"',
  LINES:2,LINE_SAMPLES:12,OFFSET:0.0,SCALING_FACTOR:1.0,MISSING_CONSTANT:'-1.0E+32',SAMPLE_BITS:32,SAMPLE_TYPE:'IEEE_REAL',MAP_PROJECTION_TYPE:'"EQUIRECTANGULAR"',
  A_AXIS_RADIUS:'470.0 <km>',B_AXIS_RADIUS:'470.0 <km>',C_AXIS_RADIUS:'470.0 <km>',COORDINATE_SYSTEM_NAME:'PLANETOCENTRIC',COORDINATE_SYSTEM_TYPE:'"BODY-FIXED ROTATING"',
  POSITIVE_LONGITUDE_DIRECTION:'EAST',CENTER_LATITUDE:'0.0 <degree>',CENTER_LONGITUDE:'180.0 <degree>',MAP_PROJECTION_ROTATION:'0.0 <degree>',MAP_RESOLUTION:`${1/30} <pixel/degree>`,
  MAXIMUM_LATITUDE:'30 <degree>',MINIMUM_LATITUDE:'-30 <degree>',EASTERNMOST_LONGITUDE:'360.0 <degree>',WESTERNMOST_LONGITUDE:'0.0 <degree>',
  LINE_PROJECTION_OFFSET:'0.5 <pixel>',SAMPLE_PROJECTION_OFFSET:'5.5 <pixel>',...overrides};
 return Object.entries(fields).map(([k,v])=>`${k} = ${v}\n`).join('')+'END\n';
}
function eastImage() {
 const bytes=Buffer.alloc(96);for(let i=0;i<24;i++)bytes.writeFloatBE(i/100,i*4);bytes.writeFloatBE(-1e32,5*4);return bytes;
}
test('detached big-endian east-positive grids place longitude eastward and keep their latitude limits',async()=>{
 const image={text:eastLabel(),imageName:'EAST.IMG'};
 const r=decodePdsFloatImage(eastImage(),eastGrid,image);
 assert.equal(r.data[1],Math.fround(0.01));assert.ok(Number.isNaN(r.data[5]),'the decimal missing constant stays missing');
 // Longitude grows with the column: 15°E is the first column, 345°E the last.
 assert.deepEqual(r.pixel(15,15),[0.5,0.5]);assert.deepEqual(r.pixel(345,-15),[11.5,1.5]);assert.deepEqual(r.pixel(-15,-15),[11.5,1.5]);
 assert.equal(r.pixel(15,45),null,'unmeasured latitudes are outside the grid');
 const root=await mkdtemp(resolve(tmpdir(),'pds-float-east-'));
 try {
  await writeFile(resolve(root,'EAST.IMG'),eastImage());await writeFile(resolve(root,'EAST.LBL'),eastLabel());
  const s=await loadPdsFloatMap(root,{path:'EAST.IMG',labelPath:'EAST.LBL',grid:eastGrid,sampling:'nearest'});
  assert.equal(s.sample(15,15),Math.fround(0));assert.equal(s.sample(45,15),Math.fround(0.01));assert.equal(s.sample(345,-15),Math.fround(0.23));
  assert.equal(s.sample(165,15),null,'missing pixel');assert.equal(s.sample(15,31),null);assert.equal(s.sample(15,-31),null);
 } finally {await rm(root,{recursive:true,force:true});}
 for(const [label,grid,bytes] of [[eastLabel({POSITIVE_LONGITUDE_DIRECTION:'WEST'}),eastGrid,eastImage()],[eastLabel({'^IMAGE':'"OTHER.IMG"'}),eastGrid,eastImage()],
   [eastLabel({MAXIMUM_LATITUDE:'90'}),eastGrid,eastImage()],[eastLabel({SAMPLE_TYPE:'PC_REAL'}),eastGrid,eastImage()],[eastLabel(),{...eastGrid,sampleType:'PC_REAL'},eastImage()],
   [eastLabel({SAMPLE_PROJECTION_OFFSET:'6.5'}),{...eastGrid,sampleProjectionOffset:6.5},eastImage()],[eastLabel(),eastGrid,eastImage().subarray(0,-4)]] as const)
  assert.throws(()=>decodePdsFloatImage(bytes,grid,{text:label,imageName:'EAST.IMG'}),/differs/);
});
