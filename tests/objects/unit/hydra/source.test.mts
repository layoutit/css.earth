import {required} from '../../../../tools/contract/test-values.mts';
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import sharp from 'sharp';
import {loadStlShape} from '../../../../tools/objects/terrestrial-layers/obj-shape.mts';
import {validateClosedMesh} from '../../../../tools/objects/terrestrial-layers/radial-terrain.mts';
const source=new URL('../../../../src/objects/hydra/source/',import.meta.url);

test('Hydra retains the released kilometre mesh and independent source anchors',async()=>{
 const recipe=JSON.parse((await readFile(new URL('preparation/terrestrial.json',source))).toString('utf8'));
 const mesh=await loadStlShape(new URL(recipe.geometry.radialTerrain.path,source).pathname,recipe.geometry.radialTerrain.grid);
 assert.equal(mesh.positions.length,26246);assert.equal(mesh.indices.length,52488);
 const topology=validateClosedMesh(Uint32Array.from(mesh.indices.flat()),mesh.positions);
 assert.equal(topology.eulerCharacteristic,2);assert.equal(topology.components,1);
 assert.ok(Math.abs(topology.signedVolumeCubicMeters/1e9-24898.419778742787)<1e-6);
 for(const [lon,lat,radius] of [[0,0,23423.08998108],[90,0,17528.92494202],[180,0,26039.52598572],[270,0,16517.19284058],[0,90,11417.36030579],[0,-90,11808.97712708]] as const)
  assert.ok(Math.abs(required(mesh.sample(lon,lat))-radius)<.001,`source anchor ${lon},${lat}`);
 assert.equal(recipe.geometry.radiusKm,18.11455731342771);
});

test('Hydra withholds unregistered photographic coverage before shared lighting',async()=>{
 const recipe=JSON.parse((await readFile(new URL('preparation/terrestrial.json',source))).toString('utf8'));
 const material=await sharp(new URL('material/neutral.png',source).pathname).raw().toBuffer({resolveWithObject:true});
 assert.equal(material.info.width,64);assert.equal(material.info.height,32);
 for(const value of material.data)assert.equal(value,160);
 assert.equal(recipe.raster.observations[0].validity.noData,160);
 const label=await readFile(new URL('survey/lor_0299165548_0x630_sci.lbl',source),'utf8');
 for(const field of ['SUB_SOLAR_LATITUDE','SUB_SOLAR_LONGITUDE','SUB_SPACECRAFT_LATITUDE','SUB_SPACECRAFT_LONGITUDE','BODY_POLE_CLOCK_ANGLE'])
  assert.match(label,new RegExp(`${field}\\s*=\\s*"N/A"`));
 const rotation=JSON.parse((await readFile(new URL('preparation/rotation.json',source))).toString('utf8'));
 assert.equal(rotation.phase,'arbitrary-display-phase');assert.equal(rotation.periodHours,10.308);
 const content=JSON.parse((await readFile(new URL('content/object.json',source))).toString('utf8'));
 assert.ok(content.settings.controls.some((control: { name: string; })=>control.name==='shadows'));
});
