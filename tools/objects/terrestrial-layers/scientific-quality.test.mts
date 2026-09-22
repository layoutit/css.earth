import { required } from '../../contract/test-values.mts';
import assert from 'node:assert/strict';
import {test} from 'node:test';
import {mkdtemp,writeFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {loadScienceSurface,validateScienceQualityMasks} from './scientific-raster.mts';
const radius=1000,resolution=Math.PI*radius/2;
const grid={width:4,height:2,targetName:'Test',centerLongitude:180,referenceRadiusMeters:radius,polarRadiusMeters:radius,origin:[-Math.PI*radius,Math.PI*radius/2],resolutionMeters:resolution,longitudeRange:[0,360],noData:-99999,projection:'equirectangular'};
function cube(values: readonly number[]){
 const header=`Object = IsisCube\n Object = Core\n StartByte = 4097\n Format = BandSequential\n Group = Dimensions\n Samples = 4\n Lines = 2\n Bands = 1\n End_Group\n Group = Pixels\n Type = Real\n ByteOrder = Lsb\n Base = 0\n Multiplier = 1\n End_Group\n Group = Mapping\n ProjectionName = SimpleCylindrical\n TargetName = Test\n LatitudeType = Planetocentric\n LongitudeDirection = PositiveEast\n LongitudeDomain = 360\n MinimumLongitude = 0\n MaximumLongitude = 360\n CenterLongitude = 180\n EquatorialRadius = ${radius}\n PolarRadius = ${radius}\n UpperLeftCornerX = ${grid.origin[0]}\n UpperLeftCornerY = ${grid.origin[1]}\n PixelResolution = ${resolution}\n End_Group\n End_Object\nEnd_Object\nEnd\n`;
 const bytes=Buffer.alloc(4096+values.length*4);bytes.write(header);values.forEach((v: number,i: number)=>bytes.writeFloatLE(v,4096+i*4));return bytes;
}
test('scientific quality masks intersect measured support without erasing valid zero or blending across boundaries',async()=>{
 const root=await mkdtemp(join(tmpdir(),'cssearth-quality-'));
 try{
  await writeFile(join(root,'values.cub'),cube([0,.5,.6,.7,.8,.9,1,1.1]));
  await writeFile(join(root,'count.cub'),cube([5,0,13,4,5,6,7,8]));
  await writeFile(join(root,'maplet.cub'),cube([125,125,99999,250,1500,1501,500,750]));
  const mask={format:'isis3',path:'count.cub',grid,sampling:'nearest',minimum:5};
  const lens={format:'isis3',path:'values.cub',grid,sampling:'nearest',qualityMasks:[mask,{format:'isis3',path:'maplet.cub',grid:{...grid,noData:99999},sampling:'nearest',maximum:1500}]};
  const surface=await loadScienceSurface(root,lens);
  assert.equal(surface.sample(45,45),0,'Five images and125m support a valid zero science value');
  for(const lon of [135,225,315])assert.equal(surface.sample(lon,45),null,'Zero/few images or missing maplet reject finite science');
  assert.ok(Math.abs(required(surface.sample(45,-45))-.8)<1e-6,'Exact1500m threshold included');
  assert.equal(surface.sample(135,-45),null,'Coarser-than-threshold excluded');
  assert.equal(surface.sample(89.999,45),0);assert.equal(surface.sample(90.001,45),null,'No quality-edge interpolation');
  const counts=await loadScienceSurface(root,mask);assert.equal(counts.sample(135,45),0,'A diagnostic retains actual zero image count');
  assert.throws(()=>validateScienceQualityMasks({...lens,sampling:'bilinear'}),/nearest/);
  assert.throws(()=>validateScienceQualityMasks({...lens,qualityMasks:[{...mask,minimum:NaN}]}),/bounded/);
 }finally{await rm(root,{recursive:true,force:true});}
});
