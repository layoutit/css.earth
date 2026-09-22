import assert from 'node:assert/strict';
import { sourceTest } from '../../../tests/objects/source-test.mts';
const test = sourceTest();
import {decodeIsis3Raster} from './isis3-raster.mts';
const qualityGrid={width:360,height:180,targetName:'Phoebe',centerLongitude:180,referenceRadiusMeters:106500,polarRadiusMeters:106500,origin:[-334579.61760731,167289.80880366],resolutionMeters:1858.775653374,longitudeRange:[0,360],allowMissingLongitudeBounds:true};
const albedoGrid={...qualityGrid,width:2222,height:1111,resolutionMeters:301.26023555494};
// Actual 2023 source label mapping. Numeric fixture values are deliberately
// synthetic; the body source test independently checks the retained products.
function fixture(g=qualityGrid,extra='') {
 const text=`Object = IsisCube\n Object = Core\n StartByte = 4097\n Format = BandSequential\n Group = Dimensions\n Samples = ${g.width}\n Lines = ${g.height}\n Bands = 1\n End_Group\n Group = Pixels\n Type = Real\n ByteOrder = Lsb\n Base = 0\n Multiplier = 1\n End_Group\n Group = Mapping\n ProjectionName = SimpleCylindrical\n TargetName = Phoebe\n LatitudeType = Planetocentric\n LongitudeDirection = PositiveEast\n LongitudeDomain = 360\n CenterLongitude = ${g.centerLongitude}\n EquatorialRadius = ${g.referenceRadiusMeters}\n PolarRadius = ${g.polarRadiusMeters}\n UpperLeftCornerX = ${g.origin[0]}\n UpperLeftCornerY = ${g.origin[1]}\n PixelResolution = ${g.resolutionMeters}\n ${extra}\n End_Group\n End_Object\nEnd_Object\nEnd\n`;
 const bytes=Buffer.alloc(4096+g.width*g.height*4);bytes.write(text);bytes.writeFloatLE(99999,4100);return bytes;
}
test('omitted ISIS longitude bounds require explicit verified global-grid opt-in',()=>{
 const bytes=fixture();
 assert.throws(()=>decodeIsis3Raster(bytes,{...qualityGrid,allowMissingLongitudeBounds:undefined}),/differs/);
 assert.throws(()=>decodeIsis3Raster(bytes,{...qualityGrid,allowMissingLongitudeBounds:false}),/differs/);
 assert.throws(()=>decodeIsis3Raster(bytes,{...qualityGrid,allowMissingLongitudeBounds:'yes'}),/boolean/);
 assert.equal(decodeIsis3Raster(bytes,qualityGrid).data[1],99999);
 assert.throws(()=>decodeIsis3Raster(fixture(qualityGrid,'MinimumLongitude = 0'),qualityGrid),/differs/);
 assert.throws(()=>decodeIsis3Raster(fixture(qualityGrid,'MinimumLongitude = -180\n MaximumLongitude = 180'),qualityGrid),/differs/);
 assert.throws(()=>decodeIsis3Raster(bytes,{...qualityGrid,longitudeRange:[-180,180]}),/differs/);
});
test('native padded global grid is preserved while missing coverage and incompatible grid fail',()=>{
 const decoded=decodeIsis3Raster(fixture(albedoGrid),albedoGrid);
 assert.equal(decoded.data.length,2222*1111);
 assert.deepEqual(decoded.origin,albedoGrid.origin);
 assert.deepEqual(decoded.resolution,[301.26023555494,-301.26023555494]);
 const right=180+(decoded.origin[0]+2222*decoded.resolution[0])*180/(Math.PI*106500);
 assert.ok(Math.abs(right-360.1296596434412)<1e-9);
 for(const candidate of [
   {...qualityGrid,width:359}, // one degree not covered
   {...qualityGrid,width:362}, // two extra pixels are not the published padding
   {...qualityGrid,origin:[qualityGrid.origin[0]+1,qualityGrid.origin[1]]}, // uncovered left edge
   {...qualityGrid,referenceRadiusMeters:100000},
 ]) assert.throws(()=>decodeIsis3Raster(fixture(candidate),candidate),/differs/);
 assert.throws(()=>decodeIsis3Raster(fixture(qualityGrid),{...qualityGrid,origin:[0,0]}),/differs/);
});
