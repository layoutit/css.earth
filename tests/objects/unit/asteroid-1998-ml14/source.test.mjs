import assert from 'node:assert/strict';
import {test} from 'node:test';
import {readFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {readAuthoredRotation} from '../../../../tools/objects/authored-rotation.mjs';
import {createSourceManifest} from '../../../../src/platform/source-manifest.mjs';
import {loadObjShape,createShapeSurfaceSampler} from '../../../../tools/objects/terrestrial-layers/obj-shape.mjs';
import {loadRadialTerrain,validateClosedMesh} from '../../../../tools/objects/terrestrial-layers/radial-terrain.mjs';
const root=resolve(import.meta.dirname,'../../../../src/planets/asteroid-1998-ml14/source');
const read=async path=>JSON.parse(await readFile(resolve(root,path),'utf8'));
test('1998 ML14 retains original source pins and acquisition closure',async()=>{
 const source=await createSourceManifest({planetId:'asteroid-1998-ml14',planetName:'1998 ML14',sourceRoot:root});await source.verify();
 const plan=await read('preparation/acquisition.json');
 const content=await read('content/object.json');assert.equal(content.settings.controls.find(c=>c.name==='shadows').checked,false);
 for(const input of source.manifest.inputs)assert.ok(plan.operations.some(step=>step.path===input.path));
});
test('1998 ML14 preserves the original kilometer mesh and qualified orientation',async()=>{
 const config=await read('preparation/terrestrial.json'),p=config.geometry.radialTerrain;
 const mesh=await loadObjShape(resolve(root,p.path),p.grid),topology=validateClosedMesh(mesh.indices.flat(),mesh.positions);
 assert.deepEqual(mesh.positions[0],[0, 0, 479.871]);
 assert.deepEqual(mesh.indices[0],[248, 1, 278]);
 assert.deepEqual([topology.vertices,topology.faces,topology.components,topology.eulerCharacteristic],[512,1020,1,2]);
 assert.ok(Math.abs(topology.signedVolumeCubicMeters/1e9-0.5112361510964633)<.00001);
 const rotation=await read('preparation/rotation.json');assert.equal(rotation.schema,'cssearth-display-orientation@1');assert.equal(rotation.periodHours,undefined);assert.equal(rotation.phase,'arbitrary-display-phase');
 const object=JSON.parse(await readFile(resolve(root,'../object.json'))),ref=object.properties.recipe.sources.find(s=>s.id==='rotation');
 for(const epoch of [2451545,2461286.5]){const frame=await readAuthoredRotation(resolve(root,'..'),ref,epoch);assert.equal(frame.spinRateRadPerDay,0);assert.equal(frame.primeMeridianRad,0);}
 const properties=await read('reference/model-properties.json');assert.equal(properties.periodHours,14.83);assert.equal(properties.photometricPeriodHours,14.28);assert.equal(properties.photometricPeriodUncertaintyHours,.01);
 const content=await read('content/object.json');assert.match(content.panel.facts.find(f=>f.id==='rotation-period').value,/14\.28/);assert.match(content.lenses.controls[0].description,/historical 1998/);assert.match(content.lenses.controls[0].description,/illustrative/);
 assert.equal(config.geometry.radiusKm,0.5);assert.equal(config.raster.scientific[0].valueTransform.offset,-0.5);
 // A second radial intersection would make one scalar height ambiguous.
 for(let i=0;i<2048;i++){const z=1-2*(i+.5)/2048,phi=i*137.50776405003785*Math.PI/180;
  const d=[Math.sqrt(1-z*z)*Math.cos(phi),Math.sqrt(1-z*z)*Math.sin(phi),z],hit=mesh.intersect([0,0,0],d);
  assert.ok(hit);assert.equal(mesh.intersect(d.map(v=>v*(hit.radius+.001)),d),null);
 }
});
test('1998 ML14 keeps a closed source-connected mesh within the retained raster budget',async()=>{
 const config=await read('preparation/terrestrial.json'),source=await createSourceManifest({planetId:'asteroid-1998-ml14',planetName:'1998 ML14',sourceRoot:root});
 const radial=await loadRadialTerrain({config,sourceDirectory:root,source});
 assert.equal(radial.faces.length,800);assert.equal(radial.simplification.sourceFaces,1020);assert.equal(radial.simplification.removedOppositeFaces,0);
 assert.equal(radial.simplification.topology.eulerCharacteristic,2);assert.ok(radial.simplification.estimatedErrorMeters<=10);
 assert.ok(radial.leaves.every(l=>l.tag==='u'&&l.attributes['data-polycss-texture-leaf-sizing']==='raster'));
 assert.deepEqual([radial.tileSize,radial.width,radial.height],[128,2048,6400]);
});

test('1998 ML14 binds elevation to known source coordinates and its reference sphere',async()=>{
 const config=await read('preparation/terrestrial.json'),lens=config.raster.scientific[0];
 const mesh=await loadObjShape(resolve(root,lens.path),lens.grid),sample=createShapeSurfaceSampler(mesh,lens).samplePoint(mesh.positions[0]);
 assert.ok(sample);assert.ok(Math.abs(sample.value-(-0.020129))<1e-9);
 assert.ok(sample.distanceMeters<1e-9);
 assert.ok(Math.abs(Math.max(...mesh.positions.map(p=>p[1]))-Math.min(...mesh.positions.map(p=>p[1]))-1035.823)<1e-6);
});
