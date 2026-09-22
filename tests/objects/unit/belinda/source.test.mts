import {array,number,shape,text} from '../../../../tools/objects/terrestrial-layers/source-records.mts';
import {required} from '../../../../tools/contract/test-values.mts';
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import sharp from 'sharp';
import {loadPdsRadiusTable} from '../../../../tools/objects/terrestrial-layers/obj-shape.mts';
import {validateClosedMesh} from '../../../../tools/objects/terrestrial-layers/radial-terrain.mts';
const source=new URL('../../../../src/objects/belinda/source/',import.meta.url);
const j=async (p: string|URL)=>JSON.parse((await readFile(new URL(p,source))).toString('utf8'));

test('Belinda preserves the published prolate axes and volume scale',async()=>{
 const recipe=await j('preparation/terrestrial.json'),g=recipe.geometry.radialTerrain;
 const mesh=await loadPdsRadiusTable(new URL(g.path,source).pathname,g.grid);
 assert.equal(mesh.positions.length,2522);assert.equal(mesh.indices.length,5040);
 const topology=validateClosedMesh(Uint32Array.from(mesh.indices.flat()),mesh.positions);
 assert.equal(topology.eulerCharacteristic,2);assert.equal(topology.components,1);
 for(const [lon,lat,r] of [[0,0,64000],[180,0,64000],[90,0,32000],[270,0,32000],[0,90,32000],[0,-90,32000]] as const)assert.ok(Math.abs(required(mesh.sample(lon,lat))-r)<.001);
 assert.ok(Math.abs(recipe.geometry.radiusKm-Math.cbrt(64*32*32))<1e-12);
 const m=await j('measurements.json');assert.equal(m.projectedEquivalentRadiusKm.value,45);assert.equal(m.projectedEquivalentRadiusKm.uncertainty,8);
});

test('Belinda has no photographic coverage and uses the body714 rotation source',async()=>{
 const material=await sharp(new URL('material/neutral.png',source).pathname).raw().toBuffer();for(const v of material)assert.equal(v,160);
 const recipe=await j('preparation/terrestrial.json');assert.equal(recipe.raster.observations[0].validity.noData,160);
 const pck=await readFile(new URL('kernels/pck00011.tpc',source),'utf8');assert.match(pck,/BODY714_PM\s*=\s*\(\s*297\.46\s+-577\.3628170/);
 const r=await j('preparation/rotation.json');assert.equal(r.spinDegreesPerDay,-577.362817);assert.equal(r.evaluation.spiceBodyId,714);
 const pole=array(array(number))(r.evaluation.bodyToJ2000).map(row=>row[2]);assert.ok(Math.abs(Math.atan2(pole[1],pole[0])*180/Math.PI+360-r.rightAscensionDegrees)<1e-10);assert.ok(Math.abs(Math.asin(pole[2])*180/Math.PI-r.declinationDegrees)<1e-10);
});
