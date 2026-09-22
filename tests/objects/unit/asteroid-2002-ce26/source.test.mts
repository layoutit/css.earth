import assert from 'node:assert/strict';
import {test} from 'node:test';
import {readFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {createSourceManifest} from '../../../../src/platform/source-manifest.mts';
import {loadObjShape,createShapeSurfaceSampler} from '../../../../tools/objects/terrestrial-layers/obj-shape.mts';
import {loadRadialTerrain,validateClosedMesh} from '../../../../tools/objects/terrestrial-layers/radial-terrain.mts';
import {requireAcquisitionPlan,requireClosedRadialTerrain,requireRadialTestConfig,requireRotation,requireShadowsContent} from '../radial-fixture.mts';
import {requireFiniteNumber,requireRecord} from '../../../../tools/sources/source-values.mts';
const root=resolve(import.meta.dirname,'../../../../src/objects/asteroid-2002-ce26/source');
const read=async (path:string):Promise<unknown>=>JSON.parse(await readFile(resolve(root,path),'utf8'));
test('2002 CE26 Primary retains original source pins and acquisition closure',async()=>{
 const source=await createSourceManifest({planetId:'asteroid-2002-ce26',planetName:'2002 CE26 Primary',sourceRoot:root});await source.verify();
 const plan=requireAcquisitionPlan(await read('preparation/acquisition.json'));
 const content=requireShadowsContent(await read('content/object.json')),shadows=content.controls.find(control=>control.name==='shadows');assert.ok(shadows);assert.equal(shadows.checked,false);
 for(const input of source.manifest.inputs)assert.ok(plan.operations.some(step=>step.path===input.path));
});
test('2002 CE26 Primary preserves the original kilometer mesh and qualified orientation',async()=>{
 const {config,terrain:p,lens}=requireRadialTestConfig(await read('preparation/terrestrial.json'));
 const mesh=await loadObjShape(resolve(root,p.path),p.grid),topology=validateClosedMesh(mesh.indices.flat(),mesh.positions);
 assert.deepEqual(mesh.positions[0],[0, 0, 1600]);
 assert.deepEqual(mesh.indices[0],[0, 1, 2]);
 assert.deepEqual([topology.vertices,topology.faces,topology.components,topology.eulerCharacteristic],[1148,2292,1,2]);
 assert.ok(Math.abs(topology.signedVolumeCubicMeters/1e9-21.671533742214205)<.00001);
 const rotation=requireRotation(await read('preparation/rotation.json'),['schema','periodHours','rightAscensionDegrees','declinationDegrees','phase']);assert.equal(rotation.schema,'cssearth-observed-pole@1');assert.equal(rotation.periodHours,3.2931);assert.ok(Math.abs(requireFiniteNumber(rotation.rightAscensionDegrees,'2002 CE26 right ascension')+33.32913984192542)<1e-9);assert.ok(Math.abs(requireFiniteNumber(rotation.declinationDegrees,'2002 CE26 declination')+34.66103827955445)<1e-9);
 const properties=requireRecord(await read('reference/model-properties.json'),'2002 CE26 model properties');assert.equal(requireFiniteNumber(properties.massKg,'2002 CE26 mass'),1.95e13);assert.equal(requireFiniteNumber(properties.massUncertaintyKg,'2002 CE26 mass uncertainty'),.25e13);assert.equal(requireFiniteNumber(properties.gravitationalParameterKm3PerS2,'2002 CE26 gravitational parameter'),1.3014885e-6);assert.equal(rotation.phase,'arbitrary-display-phase');
 assert.equal(config.geometry.radiusKm,1.73);assert.equal(lens.valueTransform.offset,-1.73);
 // A second radial intersection would make one scalar height ambiguous.
 for(let i=0;i<2048;i++){const z=1-2*(i+.5)/2048,phi=i*137.50776405003785*Math.PI/180;
  const d=[Math.sqrt(1-z*z)*Math.cos(phi),Math.sqrt(1-z*z)*Math.sin(phi),z],hit=mesh.intersect([0,0,0],d);
  assert.ok(hit);assert.equal(mesh.intersect(d.map(v=>v*(hit.radius+.001)),d),null);
 }
});
test('2002 CE26 Primary keeps a closed source-connected mesh within the retained raster budget',async()=>{
 const {config}=requireRadialTestConfig(await read('preparation/terrestrial.json')),source=await createSourceManifest({planetId:'asteroid-2002-ce26',planetName:'2002 CE26 Primary',sourceRoot:root});
 const radial=requireClosedRadialTerrain(await loadRadialTerrain({config,sourceDirectory:root,source}));
 assert.equal(radial.faces.length,800);assert.equal(radial.simplification.sourceFaces,2292);assert.equal(radial.simplification.removedOppositeFaces,0);
 assert.equal(radial.simplification.topology.eulerCharacteristic,2);assert.ok(radial.simplification.estimatedErrorMeters<=35);
 assert.ok(radial.leaves.every(l=>l.tag==='u'&&l.attributes['data-polycss-texture-leaf-sizing']==='raster'));
 assert.ok(radial.plans.reduce((sum,p)=>sum+p.rect.width*p.rect.height,0)<=16384*radial.faces.length);
});

test('2002 CE26 Primary binds elevation to known source coordinates and its reference sphere',async()=>{
 const {lens}=requireRadialTestConfig(await read('preparation/terrestrial.json'));
 const mesh=await loadObjShape(resolve(root,lens.path),lens.grid),sample=createShapeSurfaceSampler(mesh,lens).samplePoint(mesh.positions[0]);
 assert.ok(sample);assert.ok(Math.abs(sample.value-(-0.13))<1e-9);
 assert.ok(sample.distanceMeters<1e-9);
 assert.ok(Math.abs(Math.max(...mesh.positions.map(p=>p[1]))-Math.min(...mesh.positions.map(p=>p[1]))-3652.092)<1e-6);
});
