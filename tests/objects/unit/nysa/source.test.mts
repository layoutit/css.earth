import assert from 'node:assert/strict';
import {test} from 'node:test';
import {readFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {createSourceManifest} from '../../../../src/platform/source-manifest.mts';
import {loadPdsPlateShape} from '../../../../tools/objects/terrestrial-layers/obj-shape.mts';
import {loadRadialTerrain,validateClosedMesh} from '../../../../tools/objects/terrestrial-layers/radial-terrain.mts';
const root=resolve(import.meta.dirname,'../../../../src/planets/nysa/source'),read=async p=>JSON.parse(await readFile(resolve(root,p),'utf8'));
test('Nysa retains source identity and restoration closure',async()=>{
 const source=await createSourceManifest({planetId:'nysa',planetName:'Nysa',sourceRoot:root});await source.verify();
 const plan=await read('preparation/acquisition.json');for(const input of source.manifest.inputs)assert.ok(plan.operations.some(step=>step.path===input.path));
 const model=await read('reference/damit-model.json');assert.equal(model.modelId,16324);assert.equal(model.fields['Calibrated Size'],'1 (Yes)');assert.equal(model.fields.Version,'2026-07-28');
});
test('Nysa preserves calibrated original coordinates and the paired spin model',async()=>{
 const config=await read('preparation/terrestrial.json'),p=config.geometry.radialTerrain,mesh=await loadPdsPlateShape(resolve(root,p.path),p.grid),t=validateClosedMesh(mesh.indices.flat(),mesh.positions);
 assert.deepEqual(mesh.positions[0],[119.578,126.59500000000001,33478.959]);assert.deepEqual(mesh.indices[0],[0,1,2]);assert.deepEqual([t.vertices,t.faces,t.components,t.eulerCharacteristic],[1602,3200,1,2]);
 assert.ok(Math.abs(t.signedVolumeCubicMeters/1e9-223840.2774383803)<.00001);const r=await read('preparation/rotation.json');assert.equal(r.periodHours,6.421418);assert.equal(r.phase,'arbitrary-display-phase');
 assert.equal(config.raster.scientific[0].valueTransform.offset,-37.5);
 for(let i=0;i<2048;i++){const z=1-2*(i+.5)/2048,phi=i*137.50776405003785*Math.PI/180,d=[Math.sqrt(1-z*z)*Math.cos(phi),Math.sqrt(1-z*z)*Math.sin(phi),z],hit=mesh.intersect([0,0,0],d);assert.ok(hit);assert.equal(mesh.intersect(d.map(v=>v*(hit.radius+.001)),d),null);}
});
test('Nysa keeps closed source connectivity at 800 native raster leaves',async()=>{
 const config=await read('preparation/terrestrial.json'),source=await createSourceManifest({planetId:'nysa',planetName:'Nysa',sourceRoot:root}),r=await loadRadialTerrain({config,sourceDirectory:root,source});
 assert.equal(r.faces.length,800);assert.equal(r.simplification.sourceFaces,3200);assert.equal(r.simplification.removedOppositeFaces,0);assert.equal(r.simplification.topology.eulerCharacteristic,2);assert.ok(r.leaves.every(l=>l.tag==='u'&&l.attributes['data-polycss-texture-leaf-sizing']==='raster'));assert.deepEqual([r.tileSize,r.width,r.height],[128,2048,6400]);
 assert.ok(r.simplification.estimatedErrorMeters<=800);
});
