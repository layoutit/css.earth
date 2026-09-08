import assert from 'node:assert/strict';
import {test} from 'node:test';
import {readFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {createSourceManifest} from '../../../../src/platform/source-manifest.mjs';
import {loadObjShape,createShapeSurfaceSampler} from '../../../../tools/objects/terrestrial-layers/obj-shape.mjs';
import {loadRadialTerrain,validateClosedMesh} from '../../../../tools/objects/terrestrial-layers/radial-terrain.mjs';
const root=resolve(import.meta.dirname,'../../../../src/planets/mithra/source');
const read=async path=>JSON.parse(await readFile(resolve(root,path),'utf8'));
test('Mithra retains original source pins and acquisition closure',async()=>{
 const source=await createSourceManifest({planetId:'mithra',planetName:'Mithra',sourceRoot:root});await source.verify();
 const plan=await read('preparation/acquisition.json');
 for(const input of source.manifest.inputs)assert.ok(plan.operations.some(step=>step.path===input.path));
});
test('Mithra preserves the original kilometer mesh and published spin interpretation',async()=>{
 const config=await read('preparation/terrestrial.json'),p=config.geometry.radialTerrain;
 const mesh=await loadObjShape(resolve(root,p.path),p.grid),topology=validateClosedMesh(mesh.indices.flat(),mesh.positions);
 assert.deepEqual(mesh.positions[0],[0,0,407.97299999999996]);
 assert.deepEqual(mesh.indices[0],[0,1,2]);
 assert.deepEqual([topology.vertices,topology.faces,topology.components,topology.eulerCharacteristic],[3000,5996,1,2]);
 assert.ok(Math.abs(topology.signedVolumeCubicMeters/1e9-2.5326966400125923)<.00001);
 const rotation=await read('preparation/rotation.json');assert.equal(rotation.periodHours,67.5);assert.equal(rotation.phase,'arbitrary-display-phase');
 assert.equal(config.geometry.radiusKm,0.845);assert.equal(config.raster.scientific[0].valueTransform.offset,-0.845);
 const anchors=await read('reference/scalar-anchors.json'),sample=createShapeSurfaceSampler(mesh,config.raster.scientific[0]);
 for(const check of anchors.checks){const actual=sample.samplePoint(check.query);
  if(!check.accepted){assert.equal(actual,null);continue;}assert.ok(actual);
  assert.ok(Math.abs(actual.value-check.value)<1e-8);assert.ok(Math.abs(actual.distanceMeters-check.distanceMeters)<1e-6);
  actual.point.forEach((v,i)=>assert.ok(Math.abs(v-check.point[i])<1e-6));
 }

});
test('Mithra keeps a closed source-connected mesh within the retained raster budget',async()=>{
 const config=await read('preparation/terrestrial.json'),source=await createSourceManifest({planetId:'mithra',planetName:'Mithra',sourceRoot:root});
 const radial=await loadRadialTerrain({config,sourceDirectory:root,source});
 assert.equal(radial.faces.length,800);assert.equal(radial.simplification.sourceFaces,5996);assert.equal(radial.simplification.removedOppositeFaces,0);
 assert.equal(radial.simplification.topology.eulerCharacteristic,2);assert.ok(radial.simplification.estimatedErrorMeters<=21);
 assert.ok(radial.leaves.every(l=>l.tag==='u'&&l.attributes['data-polycss-texture-leaf-sizing']==='raster'));
 assert.deepEqual([radial.tileSize,radial.width,radial.height],[128,2048,6400]);
});
