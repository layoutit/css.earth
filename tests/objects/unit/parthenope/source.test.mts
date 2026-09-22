import assert from 'node:assert/strict';
import { sourceTest } from '../../source-test.mts';
const test = sourceTest('parthenope');
import {readFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {createSourceManifest} from '../../../../src/platform/source-manifest.mts';
import {loadObjShape} from '../../../../tools/objects/terrestrial-layers/obj-shape.mts';
import {loadRadialTerrain,validateClosedMesh} from '../../../../tools/objects/terrestrial-layers/radial-terrain.mts';
import {requireAcquisitionPlan,requireClosedRadialTerrain,requireRadialTestConfig,requireRotation} from '../radial-fixture.mts';
const root=resolve(import.meta.dirname,'../../../../src/objects/parthenope/source');
const read=async (path:string):Promise<unknown>=>JSON.parse(await readFile(resolve(root,path),'utf8'));
test('Parthenope preserves the original kilometer mesh and published spin interpretation',async()=>{
 const {config,terrain:p,lens}=requireRadialTestConfig(await read('preparation/terrestrial.json'));
 const mesh=await loadObjShape(resolve(root,p.path),p.grid),topology=validateClosedMesh(mesh.indices.flat(),mesh.positions);
 assert.deepEqual(mesh.positions[0],[33.846702,-88.584051,66871.933]);
 assert.deepEqual(mesh.indices[0],[0,568,569]);
 assert.deepEqual([topology.vertices,topology.faces,topology.components,topology.eulerCharacteristic],[2266,4528,1,2]);
 assert.ok(Math.abs(topology.signedVolumeCubicMeters/1e9-1702501.0176141364)<.00001);
 const rotation=requireRotation(await read('preparation/rotation.json'),['periodHours','phase']);assert.equal(rotation.periodHours,13.72204);assert.equal(rotation.phase,'arbitrary-display-phase');
 assert.equal(config.geometry.radiusKm,74.5);assert.equal(lens.valueTransform.offset,-74.5);
 // A second radial intersection would make one scalar height ambiguous.
 for(let i=0;i<2048;i++){const z=1-2*(i+.5)/2048,phi=i*137.50776405003785*Math.PI/180;
  const d=[Math.sqrt(1-z*z)*Math.cos(phi),Math.sqrt(1-z*z)*Math.sin(phi),z],hit=mesh.intersect([0,0,0],d);
  assert.ok(hit);assert.equal(mesh.intersect(d.map(v=>v*(hit.radius+.001)),d),null);
 }
});
test('Parthenope keeps a closed source-connected mesh within the retained raster budget',async()=>{
 const {config}=requireRadialTestConfig(await read('preparation/terrestrial.json')),source=await createSourceManifest({planetId:'parthenope',planetName:'Parthenope',sourceRoot:root});
 const radial=requireClosedRadialTerrain(await loadRadialTerrain({config,sourceDirectory:root,source}));
 assert.equal(radial.faces.length,800);assert.equal(radial.simplification.sourceFaces,4528);assert.equal(radial.simplification.removedOppositeFaces,0);
 assert.equal(radial.simplification.topology.eulerCharacteristic,2);assert.ok(radial.simplification.estimatedErrorMeters<=1300);
 assert.ok(radial.leaves.every(l=>l.tag==='u'&&l.attributes['data-polycss-texture-leaf-sizing']==='raster'));
 assert.ok(radial.plans.reduce((sum,p)=>sum+p.rect.width*p.rect.height,0)<=16384*radial.faces.length);
});
