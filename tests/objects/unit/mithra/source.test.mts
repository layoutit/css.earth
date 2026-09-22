import assert from 'node:assert/strict';
import { sourceTest } from '../../source-test.mts';
const test = sourceTest('mithra');
import {readFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {createSourceManifest} from '../../../../src/platform/source-manifest.mts';
import {loadObjShape,createShapeSurfaceSampler} from '../../../../tools/objects/terrestrial-layers/obj-shape.mts';
import {loadRadialTerrain,validateClosedMesh} from '../../../../tools/objects/terrestrial-layers/radial-terrain.mts';
import {requireAcquisitionPlan,requireClosedRadialTerrain,requireRadialTestConfig,requireRotation,requireScalarAnchors} from '../radial-fixture.mts';
const root=resolve(import.meta.dirname,'../../../../src/objects/mithra/source');
const read=async (path:string):Promise<unknown>=>JSON.parse(await readFile(resolve(root,path),'utf8'));
test('Mithra preserves the original kilometer mesh and published spin interpretation',async()=>{
 const {config,terrain:p,lens}=requireRadialTestConfig(await read('preparation/terrestrial.json'));
 const mesh=await loadObjShape(resolve(root,p.path),p.grid),topology=validateClosedMesh(mesh.indices.flat(),mesh.positions);
 assert.deepEqual(mesh.positions[0],[0,0,407.97299999999996]);
 assert.deepEqual(mesh.indices[0],[0,1,2]);
 assert.deepEqual([topology.vertices,topology.faces,topology.components,topology.eulerCharacteristic],[3000,5996,1,2]);
 assert.ok(Math.abs(topology.signedVolumeCubicMeters/1e9-2.5326966400125923)<.00001);
 const rotation=requireRotation(await read('preparation/rotation.json'),['periodHours','phase']);assert.equal(rotation.periodHours,67.5);assert.equal(rotation.phase,'arbitrary-display-phase');
 assert.equal(config.geometry.radiusKm,0.845);assert.equal(lens.valueTransform.offset,-0.845);
 const anchors=requireScalarAnchors(await read('reference/scalar-anchors.json')),sample=createShapeSurfaceSampler(mesh,lens);
 for(const check of anchors){const actual=sample.samplePoint(check.query);
  if(!check.accepted){assert.equal(actual,null);continue;}assert.ok(actual);
  assert.ok(Math.abs(actual.value-check.value)<1e-8);assert.ok(Math.abs(actual.distanceMeters-check.distanceMeters)<1e-6);
  actual.point.forEach((v,i)=>assert.ok(Math.abs(v-check.point[i])<1e-6));
 }

});
test('Mithra keeps a closed source-connected mesh within the retained raster budget',async()=>{
 const {config}=requireRadialTestConfig(await read('preparation/terrestrial.json')),source=await createSourceManifest({planetId:'mithra',planetName:'Mithra',sourceRoot:root});
 const radial=requireClosedRadialTerrain(await loadRadialTerrain({config,sourceDirectory:root,source}));
 assert.equal(radial.faces.length,800);assert.equal(radial.simplification.sourceFaces,5996);assert.equal(radial.simplification.removedOppositeFaces,0);
 assert.equal(radial.simplification.topology.eulerCharacteristic,2);assert.ok(radial.simplification.estimatedErrorMeters<=21);
 assert.ok(radial.leaves.every(l=>l.tag==='u'&&l.attributes['data-polycss-texture-leaf-sizing']==='raster'));
 assert.ok(radial.plans.reduce((sum,p)=>sum+p.rect.width*p.rect.height,0)<=16384*radial.faces.length);
});
