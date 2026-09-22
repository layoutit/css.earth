import {required} from '../../../../tools/contract/test-values.mts';
import { sourceTest } from '../../source-test.mts';
const test = sourceTest('metis');
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {loadPdsRadiusTable} from '../../../../tools/objects/terrestrial-layers/obj-shape.mts';
const source=new URL('../../../../src/objects/metis/source/',import.meta.url);
test('Metis reference shape reproduces the PCK dimensions without invented terrain',async()=>{
 const pck=await readFile(new URL('shape/pck00011.tpc',source),'utf8');
 const axes=required(pck.match(/BODY516_RADII\s*=\s*\(([^)]+)\)/))[1].trim().split(/\s+/).map(Number);
 assert.deepEqual(axes,[30,20,17]);
 const text=await readFile(new URL('shape/metis-ellipsoid.tab',source),'utf8');
 for(const line of text.trim().split('\n')){
  const [lon,lat,r]=line.trim().split(/\s+/).map(Number),l=lon*Math.PI/180,p=lat*Math.PI/180;
  const expected=1/Math.hypot(Math.cos(p)*Math.cos(l)/axes[0],Math.cos(p)*Math.sin(l)/axes[1],Math.sin(p)/axes[2]);
  assert.ok(Math.abs(r-expected)<5.1e-9);
 }
 const grid=await loadPdsRadiusTable(new URL('shape/metis-ellipsoid.tab',source).pathname,{metersPerUnit:1000,expectedVertices:2522,expectedFaces:5040,stepDegrees:5,longitudeDirection:'west-positive'});
 assert.equal(grid.positions.length,2522);assert.equal(grid.indices.length,5040);
 for(const [lon,lat,expected] of [[0,0,30000],[90,0,20000],[0,90,17000],[0,-90,17000]] as const)assert.ok(Math.abs(required(grid.sample(lon,lat))-expected)<.001);
});
test('Metis camera directions agree with source phase, scale and raw image north',async()=>{
 const recipe=JSON.parse((await readFile(new URL('preparation/terrestrial.json',source))).toString('utf8'));
 for(const frame of recipe.raster.surfaceObservations.find((lens:{id:string})=>lens.id==='normal').frames){
  const metadata=JSON.parse((await readFile(new URL(`geometry/${frame.id}-opus.json`,source))).toString('utf8'))['Metis Surface Geometry Constraints'];
  const [lat,lon,slat,slon]=[frame.observerLatitude,frame.observerWestLongitude,frame.sunLatitude,frame.sunWestLongitude].map(v=>v*Math.PI/180);
  const phase=Math.acos(Math.sin(lat)*Math.sin(slat)+Math.cos(lat)*Math.cos(slat)*Math.cos(lon-slon))*180/Math.PI;
  assert.ok(Math.abs(phase-Number(metadata.SURFACEGEOmetis_centerphaseangle1))<.01);
  assert.ok(Math.abs(frame.rangeKm*frame.pixelAngleMicroradians*1e-6-Number(metadata.SURFACEGEOmetis_centerresolution1))<1e-8);
  const label=await readFile(new URL(frame.labelPath,source),'utf8'),north=Number(required(label.match(/^NORTH_AZIMUTH\s*=\s*([-+.\d]+)/m))[1]);
  assert.ok(Math.abs(frame.northAzimuthDegrees-(north+90)%360)<1e-8);
 }
});
