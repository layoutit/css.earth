import assert from 'node:assert/strict';
import {test} from 'node:test';
import {createSourceFixtureReader,requireClosedTerrain} from '../../fixtures/source-fixture.mts';
import {resolve} from 'node:path';
import {createSourceManifest} from '../../../../src/platform/source-manifest.mts';
import {loadObjShape,createShapeSurfaceSampler} from '../../../../tools/objects/terrestrial-layers/obj-shape.mts';
import {loadRadialTerrain,validateClosedMesh} from '../../../../tools/objects/terrestrial-layers/radial-terrain.mts';
const root=resolve(import.meta.dirname,'../../../../src/objects/nereus/source');
const read=createSourceFixtureReader(root);
test('Nereus preserves the original kilometer mesh and published spin interpretation',async()=>{
 const config=await read('preparation/terrestrial.json'),p=config.geometry.radialTerrain;
 const mesh=await loadObjShape(resolve(root,p.path),p.grid),topology=validateClosedMesh(mesh.indices.flat(),mesh.positions);
 assert.deepEqual(mesh.positions[0],[0,0,116.03099999999999]);
 assert.deepEqual(mesh.indices[0],[0,1,2]);
 assert.deepEqual([topology.vertices,topology.faces,topology.components,topology.eulerCharacteristic],[1148,2292,1,2]);
 assert.ok(Math.abs(topology.signedVolumeCubicMeters/1e9-0.019401719790329626)<.00001);
 const rotation=await read('preparation/rotation.json');assert.equal(rotation.periodHours,15.16);assert.equal(rotation.phase,'arbitrary-display-phase');
 assert.equal(config.geometry.radiusKm,0.165);assert.equal(config.raster.scientific[0].valueTransform.offset,-0.165);
 const anchors=await read('reference/scalar-anchors.json'),sample=createShapeSurfaceSampler(mesh,config.raster.scientific[0]);
 for(const check of anchors.checks){const actual=sample.samplePoint(check.query);
  if(!check.accepted){assert.equal(actual,null);continue;}assert.ok(actual);
  assert.ok(Math.abs(actual.value-check.value)<1e-8);assert.ok(Math.abs(actual.distanceMeters-check.distanceMeters)<1e-6);
  actual.point.forEach((v,i)=>assert.ok(Math.abs(v-check.point[i])<1e-6));
 }

});
test('Nereus keeps a closed source-connected mesh within the retained raster budget',async()=>{
 const config=await read('preparation/terrestrial.json'),source=await createSourceManifest({planetId:'nereus',planetName:'Nereus',sourceRoot:root});
 const radial=requireClosedTerrain(await loadRadialTerrain({config,sourceDirectory:root,source}));
 assert.equal(radial.faces.length,800);assert.equal(radial.simplification.sourceFaces,2292);assert.equal(radial.simplification.removedOppositeFaces,0);
 assert.equal(radial.simplification.topology.eulerCharacteristic,2);assert.ok(radial.simplification.estimatedErrorMeters<=3);
 assert.ok(radial.leaves.every(l=>l.tag==='u'&&l.attributes['data-polycss-texture-leaf-sizing']==='raster'));
 assert.ok(radial.plans.reduce((sum,p)=>sum+p.rect.width*p.rect.height,0)<=16384*radial.faces.length);
});
