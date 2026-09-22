import {required} from '../../../../tools/contract/test-values.mts';
import assert from 'node:assert/strict';
import{test}from'node:test';
import{readFile}from'node:fs/promises';
import{resolve}from'node:path';
import{loadPdsRadialTable}from'../../../../tools/objects/terrestrial-layers/pds-radial-table.mts';
import{readAuthoredRotation}from'../../../../tools/objects/authored-rotation.mts';
import{assertAsteroidPackage}from'../asteroid-contract.mts';
const base=resolve(import.meta.dirname,'../../../../src/objects/mathilde');
const read=async (p: string)=>JSON.parse(await readFile(resolve(base,p),'utf8'));
test('Mathilde Stooke column order, east longitude and meter scale preserve independent release anchors',async()=>{
 const config=await read('source/preparation/terrestrial.json'),profile=config.geometry.radialTerrain;
 const grid=await loadPdsRadialTable(resolve(base,'source',profile.path),profile.grid);
 for(const[longitude,latitude,radiusMeters]of[[0,0,27080.9],[90,0,25248],[180,0,25712.7],[270,0,24467.2],[0,-90,22126.3],[0,90,23668.1],[210,30,30680.4]] as const){
  assert.ok(Math.abs(required(grid.sample(longitude,latitude))-radiusMeters)<1e-6,`${longitude}E ${latitude}N source anchor`);
 }
});
test('Mathilde elevation rejects source placeholders before interpolation and reverses the Thomas west longitudes',async()=>{
 const config=await read('source/preparation/terrestrial.json'),lens=config.raster.scientific[0];
 const grid=await loadPdsRadialTable(resolve(base,'source',lens.path),lens.grid);
 assert.equal(grid.sample(0,0),null);assert.equal(grid.sample(0,90),null);
 // 246W at the equator is 25.9114 km, but its next west-longitude cell is the 26.5 km placeholder.
 assert.equal(grid.sample(112.5,0),null,'A half-cell sample must not interpolate observed radius into the adjacent placeholder');
 assert.ok(Math.abs(required(grid.sample(210,30))-30680.4)<1e-6);
 assert.ok(Math.abs(required(grid.sample(270,0))-24383.9)<1e-6);
 assert.deepEqual(lens.valueTransform,{scale:.001,offset:-26.4});
 const rows=(await readFile(resolve(base,'source/shape/253mathilde.tab'),'utf8')).trim().split(/\r?\n/).map(l=>l.trim().split(/\s+/).map(Number));
 assert.equal(rows.filter(r=>r[2]===26.5).length,3688);
 // 0E,0N is filled in Stooke, but must remain absent from measured elevation.
 const shape=config.geometry.radialTerrain,display=await loadPdsRadialTable(resolve(base,'source',shape.path),shape.grid);
 assert.equal(display.sample(0,0),27080.9);
});
test('Mathilde arbitrary orientation does not produce a measured spin rate',async()=>{
 const descriptor=await read('object.json'),ref=descriptor.properties.recipe.sources.find((s: { id: string; })=>s.id==='rotation');
 const a=await readAuthoredRotation(base,ref,2451545),b=await readAuthoredRotation(base,ref,2461286.5);
 assert.equal(a.spinRateRadPerDay,0);assert.deepEqual(a,b);
});
test('Mathilde has closed published visualization meshes, retained raster leaves and prepared asset closure',()=>assertAsteroidPackage('mathilde',['normal','near-msi','elevation'],26400));
