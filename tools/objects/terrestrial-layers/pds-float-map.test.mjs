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
