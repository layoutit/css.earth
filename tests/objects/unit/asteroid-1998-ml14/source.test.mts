import assert from 'node:assert/strict';
import {test} from 'node:test';
import {readFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {readAuthoredRotation} from '../../../../tools/objects/authored-rotation.mts';
import {createSourceManifest} from '../../../../src/platform/source-manifest.mts';
import {loadObjShape,createShapeSurfaceSampler} from '../../../../tools/objects/terrestrial-layers/obj-shape.mts';
import {loadRadialTerrain,validateClosedMesh} from '../../../../tools/objects/terrestrial-layers/radial-terrain.mts';
import {requireAcquisitionPlan,requireClosedRadialTerrain,requireMl14Content,requireObjectRotationReference,requireRadialTestConfig} from '../radial-fixture.mts';
import {requireFiniteNumber,requireRecord,requireString} from '../../../../tools/sources/source-values.mts';
const root=resolve(import.meta.dirname,'../../../../src/objects/asteroid-1998-ml14/source');
const read=async (path:string):Promise<unknown>=>JSON.parse(await readFile(resolve(root,path),'utf8'));
test('1998 ML14 retains original source pins and acquisition closure',async()=>{
 const source=await createSourceManifest({planetId:'asteroid-1998-ml14',planetName:'1998 ML14',sourceRoot:root});await source.verify();
 const plan=requireAcquisitionPlan(await read('preparation/acquisition.json'));
 const content=requireMl14Content(await read('content/object.json')),shadows=content.settings.controls.find(control=>control.name==='shadows');assert.ok(shadows);assert.equal(shadows.checked,false);
 for(const input of source.manifest.inputs)assert.ok(plan.operations.some(step=>step.path===input.path));
});
test('1998 ML14 preserves the original kilometer mesh and qualified orientation',async()=>{
 const {config,terrain:p,lens}=requireRadialTestConfig(await read('preparation/terrestrial.json'));
 const mesh=await loadObjShape(resolve(root,p.path),p.grid),topology=validateClosedMesh(mesh.indices.flat(),mesh.positions);
 assert.deepEqual(mesh.positions[0],[0, 0, 479.871]);
 assert.deepEqual(mesh.indices[0],[248, 1, 278]);
 assert.deepEqual([topology.vertices,topology.faces,topology.components,topology.eulerCharacteristic],[512,1020,1,2]);
 assert.ok(Math.abs(topology.signedVolumeCubicMeters/1e9-0.5112361510964633)<.00001);
 const rotation=requireRecord(await read('preparation/rotation.json'),'1998 ML14 rotation');assert.equal(requireString(rotation.schema,'1998 ML14 rotation schema'),'cssearth-display-orientation@1');assert.equal(rotation.periodHours,undefined);assert.equal(requireString(rotation.phase,'1998 ML14 rotation phase'),'arbitrary-display-phase');
 const reference=requireObjectRotationReference(JSON.parse(await readFile(resolve(root,'../object.json'),'utf8')));
 for(const epoch of [2451545,2461286.5]){const frame=await readAuthoredRotation(resolve(root,'..'),reference,epoch);assert.equal(frame.spinRateRadPerDay,0);assert.equal(frame.primeMeridianRad,0);}
 const properties=requireRecord(await read('reference/model-properties.json'),'1998 ML14 model properties');assert.equal(requireFiniteNumber(properties.periodHours,'1998 ML14 model period'),14.83);assert.equal(requireFiniteNumber(properties.photometricPeriodHours,'1998 ML14 photometric period'),14.28);assert.equal(requireFiniteNumber(properties.photometricPeriodUncertaintyHours,'1998 ML14 photometric period uncertainty'),.01);
 const content=requireMl14Content(await read('content/object.json')),period=content.panel.facts.find(fact=>fact.id==='rotation-period');assert.ok(period);assert.match(period.value,/14\.28/);assert.ok(content.lenses.controls[0]);const text=requireRecord(await read('../text.json'),'1998 ML14 text'),datasets=requireRecord(text.datasets,'1998 ML14 datasets'),shape=requireRecord(datasets[content.lenses.controls[0].id],'1998 ML14 shape text');assert.match(requireString(shape.summary,'1998 ML14 shape summary'),/historical 1998/);assert.match(requireString(shape.summary,'1998 ML14 shape summary'),/later revised/);
 assert.equal(config.geometry.radiusKm,0.5);assert.equal(lens.valueTransform.offset,-0.5);
 // A second radial intersection would make one scalar height ambiguous.
 for(let i=0;i<2048;i++){const z=1-2*(i+.5)/2048,phi=i*137.50776405003785*Math.PI/180;
  const d=[Math.sqrt(1-z*z)*Math.cos(phi),Math.sqrt(1-z*z)*Math.sin(phi),z],hit=mesh.intersect([0,0,0],d);
  assert.ok(hit);assert.equal(mesh.intersect(d.map(v=>v*(hit.radius+.001)),d),null);
 }
});
test('1998 ML14 keeps a closed source-connected mesh within the retained raster budget',async()=>{
 const {config}=requireRadialTestConfig(await read('preparation/terrestrial.json')),source=await createSourceManifest({planetId:'asteroid-1998-ml14',planetName:'1998 ML14',sourceRoot:root});
 const radial=requireClosedRadialTerrain(await loadRadialTerrain({config,sourceDirectory:root,source}));
 assert.equal(radial.faces.length,800);assert.equal(radial.simplification.sourceFaces,1020);assert.equal(radial.simplification.removedOppositeFaces,0);
 assert.equal(radial.simplification.topology.eulerCharacteristic,2);assert.ok(radial.simplification.estimatedErrorMeters<=10);
 assert.ok(radial.leaves.every(l=>l.tag==='u'&&l.attributes['data-polycss-texture-leaf-sizing']==='raster'));
 assert.ok(radial.plans.reduce((sum,p)=>sum+p.rect.width*p.rect.height,0)<=16384*radial.faces.length);
});

test('1998 ML14 binds elevation to known source coordinates and its reference sphere',async()=>{
 const {lens}=requireRadialTestConfig(await read('preparation/terrestrial.json'));
 const mesh=await loadObjShape(resolve(root,lens.path),lens.grid),sample=createShapeSurfaceSampler(mesh,lens).samplePoint(mesh.positions[0]);
 assert.ok(sample);assert.ok(Math.abs(sample.value-(-0.020129))<1e-9);
 assert.ok(sample.distanceMeters<1e-9);
 assert.ok(Math.abs(Math.max(...mesh.positions.map(p=>p[1]))-Math.min(...mesh.positions.map(p=>p[1]))-1035.823)<1e-6);
});
