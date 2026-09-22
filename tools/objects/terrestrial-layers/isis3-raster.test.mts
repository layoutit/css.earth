import assert from 'node:assert/strict';
import { sourceTest } from '../../../tests/objects/source-test.mts';
const test = sourceTest();
import {gzipSync} from 'node:zlib';
import {decodeIsis3Raster} from './isis3-raster.mts';
import {scienceMapPoint} from './scientific-raster.mts';
const grid={width:3,height:3,targetName:'Example',centerLongitude:180,referenceRadiusMeters:1000,polarRadiusMeters:900,origin:[-100,100],resolutionMeters:10,longitudeRange:[0,360]};
function fixture(format='Tile') {
 const label=`Object = IsisCube\n Object = Core\n StartByte = 4097\n Format = ${format}\n TileSamples = 2\n TileLines = 2\n Group = Dimensions\n Samples = 3\n Lines = 3\n Bands = 1\n End_Group\n Group = Pixels\n Type = Real\n ByteOrder = Lsb\n Base = 0\n Multiplier = 1\n End_Group\n Group = Mapping\n ProjectionName = SimpleCylindrical\n TargetName = Example\n LatitudeType = Planetocentric\n LongitudeDirection = PositiveEast\n LongitudeDomain = 360\n MinimumLongitude = 0\n MaximumLongitude = 360\n CenterLongitude = 180\n EquatorialRadius = 1000\n PolarRadius = 900\n UpperLeftCornerX = -100\n UpperLeftCornerY = 100\n PixelResolution = 10\n End_Group\n End_Object\nEnd_Object\nEnd\n`;
 // Four 2x2 tiles, including unused edge padding. Independent explicit storage order.
 const values=format==='Tile'?[1,2,4,5,3,99,6,99,7,8,99,99,9,99,99,99]:[1,2,3,4,5,6,7,8,9];
 const bytes=Buffer.alloc(4096+values.length*4);bytes.write(label);values.forEach((v,i)=>bytes.writeFloatLE(v,4096+i*4));return bytes;
}
test('ISIS3 tiles retain rows, edge tiles and floating point special pixels',()=>{
 const bytes=fixture();bytes.writeFloatLE(-3.4028226550889045e38,4100);
 const {data}=decodeIsis3Raster(gzipSync(bytes),grid);
 assert.deepEqual([...data],[1,Math.fround(-3.4028226550889045e38),3,4,5,6,7,8,9]);
 assert.deepEqual([...decodeIsis3Raster(fixture('BandSequential'),grid).data],[1,2,3,4,5,6,7,8,9]);
 assert.throws(()=>decodeIsis3Raster(bytes.subarray(0,-1),grid),/Truncated/);
 assert.throws(()=>decodeIsis3Raster(bytes,{...grid,centerLongitude:0}),/differs/);
 assert.throws(()=>decodeIsis3Raster(bytes,{...grid,width:4}),/differs/);
});
test('mapped longitude extent selects the correct half of a wrapped ISIS3 mosaic',()=>{
 const base={referenceRadiusMeters:180/Math.PI,centerLongitude:180};
 assert.deepEqual(scienceMapPoint(270,-45,{...base,longitudeRange:[-180,180]}),[-270,-45]);
 assert.deepEqual(scienceMapPoint(270,-45,{...base,longitudeRange:[0,360]}),[90,-45]);
 assert.deepEqual(scienceMapPoint(90,-45,{...base,longitudeRange:[-180,180]}),[-90,-45]);
});

test('native multiband ISIS core uses complete tiles per band and preserves special values before scaling',async()=>{
 const {decodeIsis3Core}=await import('./isis3-raster.mts');
 const one=fixture(),header=one.subarray(0,4096).toString().replace('Bands = 1','Bands = 2').replace('Base = 0','Base = 10').replace('Multiplier = 1','Multiplier = 2');
 const bytes=Buffer.concat([Buffer.alloc(4096),one.subarray(4096),one.subarray(4096)]);bytes.write(header);
 bytes.writeUInt32LE(0xff7ffffb,4096);
 const decoded=decodeIsis3Core(bytes);assert.equal(decoded.bands,2);assert.equal(decoded.data.length,18);
 assert.ok(decoded.data[0]! < -3e38);assert.deepEqual([...decoded.data.slice(9)],[12,14,16,18,20,22,24,26,28]);
 assert.throws(()=>decodeIsis3Core(bytes.subarray(0,-1)),/Truncated/);
});
