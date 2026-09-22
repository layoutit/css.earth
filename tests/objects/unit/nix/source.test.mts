import {required} from '../../../../tools/contract/test-values.mts';
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import sharp from 'sharp';
import {loadStlShape} from '../../../../tools/objects/terrestrial-layers/obj-shape.mts';
import {validateClosedMesh} from '../../../../tools/objects/terrestrial-layers/radial-terrain.mts';
const source=new URL('../../../../src/objects/nix/source/',import.meta.url);

test('Nix retains the released source mesh scale and independent source anchors',async()=>{
 const recipe=JSON.parse((await readFile(new URL('preparation/terrestrial.json',source))).toString('utf8'));
 const mesh=await loadStlShape(new URL(recipe.geometry.radialTerrain.path,source).pathname,recipe.geometry.radialTerrain.grid);
 assert.equal(mesh.positions.length,40002);assert.equal(mesh.indices.length,80000);
 const topology=validateClosedMesh(Uint32Array.from(mesh.indices.flat()),mesh.positions);
 assert.equal(topology.eulerCharacteristic,2);assert.equal(topology.components,1);
 assert.ok(Math.abs(topology.signedVolumeCubicMeters/1e9-25526.46727196375)<1e-6);
 for(const [lon,lat,radius] of [[0,0,22654.277801515],[90,0,13741.85562134],[180,0,24838.7298584],[270,0,16925.86326599],[0,90,16357.99598694],[0,-90,12884.452819825]] as const)
  assert.ok(Math.abs(required(mesh.sample(lon,lat))-radius)<.001,`source anchor ${lon},${lat}`);
 assert.equal(recipe.geometry.radiusKm,18.265603887767425);
 assert.equal(recipe.geometry.radialTerrain.grid.metersPerUnit,500);
 const release=JSON.parse((await readFile(new URL('survey/figshare-v1.json',source))).toString('utf8'));
 assert.match(release.description,/48\.4×33\.8×31\.4/);
});

test('Nix withholds unregistered photographic coverage before shared lighting',async()=>{
 const recipe=JSON.parse((await readFile(new URL('preparation/terrestrial.json',source))).toString('utf8'));
 const material=await sharp(new URL('material/neutral.png',source).pathname).raw().toBuffer({resolveWithObject:true});
 assert.equal(material.info.width,64);assert.equal(material.info.height,32);
 for(const value of material.data)assert.equal(value,160);
 assert.equal(recipe.raster.observations[0].validity.noData,160);
 const label=await readFile(new URL('survey/lorri-best.lbl',source),'utf8');
 for(const field of ['SUB_SOLAR_LATITUDE','SUB_SOLAR_LONGITUDE','SUB_SPACECRAFT_LATITUDE','SUB_SPACECRAFT_LONGITUDE','BODY_POLE_CLOCK_ANGLE'])
  assert.match(label,new RegExp(`${field}\\s*=\\s*"N/A"`));
 const rotation=JSON.parse((await readFile(new URL('preparation/rotation.json',source))).toString('utf8'));
 assert.equal(rotation.phase,'arbitrary-display-phase');assert.equal(rotation.periodHours,43.896);
 const content=JSON.parse((await readFile(new URL('content/object.json',source))).toString('utf8'));
 assert.ok(content.settings.controls.some((control: { name: string; })=>control.name==='shadows'));
});
