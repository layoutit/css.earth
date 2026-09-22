import assert from 'node:assert/strict';
import {test} from 'node:test';
import {readFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {createSourceManifest} from '../../../../src/platform/source-manifest.mts';
import {readAuthoredRotation} from '../../../../tools/objects/authored-rotation.mts';
import {loadObjShape} from '../../../../tools/objects/terrestrial-layers/obj-shape.mts';
import {loadRadialTerrain,validateClosedMesh} from '../../../../tools/objects/terrestrial-layers/radial-terrain.mts';
import {requireAcquisitionPlan,requireClosedRadialTerrain,requireObjectRotationReference,requireRadialTestConfig} from '../radial-fixture.mts';
import {requireFiniteNumber,requireRecord,requireString} from '../../../../tools/sources/source-values.mts';
const root=resolve(import.meta.dirname,'../../../../src/objects/apophis/source');
const read=async (path:string):Promise<unknown>=>JSON.parse(await readFile(resolve(root,path),'utf8'));
test('Apophis retains original source pins and acquisition closure',async()=>{
 const source=await createSourceManifest({planetId:'apophis',planetName:'Apophis',sourceRoot:root});await source.verify();
 const plan=requireAcquisitionPlan(await read('preparation/acquisition.json'));
 for(const input of source.manifest.inputs)assert.ok(plan.operations.some(step=>step.path===input.path));
});
test('Apophis preserves the original kilometer mesh and published spin interpretation',async()=>{
 const {config,terrain:p,lens}=requireRadialTestConfig(await read('preparation/terrestrial.json'));
 const mesh=await loadObjShape(resolve(root,p.path),p.grid),topology=validateClosedMesh(mesh.indices.flat(),mesh.positions);
 assert.deepEqual(mesh.positions[0],[0,0,166.496]);
 assert.deepEqual(mesh.indices[0],[0,1,2]);
 assert.deepEqual([topology.vertices,topology.faces,topology.components,topology.eulerCharacteristic],[2000,3996,1,2]);
 assert.ok(Math.abs(topology.signedVolumeCubicMeters/1e9-0.019825778758735674)<.00001);
 const rotation=requireRecord(await read('preparation/rotation.json'),'Apophis rotation');assert.equal(requireString(rotation.schema,'Apophis rotation schema'),'cssearth-display-orientation@1');assert.equal(rotation.periodHours,undefined);const reference=requireObjectRotationReference(JSON.parse(await readFile(resolve(root,'../object.json'),'utf8')));const frame=await readAuthoredRotation(resolve(root,'..'),reference,2461286.5);assert.equal(frame.spinRateRadPerDay,0);const spin=(await readFile(resolve(root,'reference/apophis_v233s7_spin_state.csv'),'utf8')).trim().split(',').map((value,index)=>requireFiniteNumber(Number(value),`Apophis spin state ${index}`));assert.deepEqual([spin[0],spin[5],spin[7]],[99942,27.45,265.7]);assert.equal(requireString(rotation.phase,'Apophis rotation phase'),'arbitrary-display-phase');
 assert.equal(config.geometry.radiusKm,0.17);assert.equal(lens.valueTransform.offset,-0.17);
 // A second radial intersection would make one scalar height ambiguous.
 for(let i=0;i<2048;i++){const z=1-2*(i+.5)/2048,phi=i*137.50776405003785*Math.PI/180;
  const d=[Math.sqrt(1-z*z)*Math.cos(phi),Math.sqrt(1-z*z)*Math.sin(phi),z],hit=mesh.intersect([0,0,0],d);
  assert.ok(hit);assert.equal(mesh.intersect(d.map(v=>v*(hit.radius+.001)),d),null);
 }
});
test('Apophis keeps a closed source-connected mesh within the retained raster budget',async()=>{
 const {config}=requireRadialTestConfig(await read('preparation/terrestrial.json')),source=await createSourceManifest({planetId:'apophis',planetName:'Apophis',sourceRoot:root});
 const radial=requireClosedRadialTerrain(await loadRadialTerrain({config,sourceDirectory:root,source}));
 assert.equal(radial.faces.length,800);assert.equal(radial.simplification.sourceFaces,3996);assert.equal(radial.simplification.removedOppositeFaces,0);
 assert.equal(radial.simplification.topology.eulerCharacteristic,2);assert.ok(radial.simplification.estimatedErrorMeters<=4);
 assert.ok(radial.leaves.every(l=>l.tag==='u'&&l.attributes['data-polycss-texture-leaf-sizing']==='raster'));
 assert.ok(radial.plans.reduce((sum,p)=>sum+p.rect.width*p.rect.height,0)<=16384*radial.faces.length);
});
