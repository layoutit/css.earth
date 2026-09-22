import {requireAcquisitionPlan, requireClosedRadialTerrain, requireRadialTestConfig, requireRotation} from '../radial-fixture.mts';
import {requireRecord} from '../../../../tools/sources/source-values.mts';
import assert from 'node:assert/strict';
import { sourceTest } from '../../source-test.mts';
const test = sourceTest('herculina');
import {readFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {createSourceManifest} from '../../../../src/platform/source-manifest.mts';
import {loadPdsPlateShape} from '../../../../tools/objects/terrestrial-layers/obj-shape.mts';
import {loadRadialTerrain,validateClosedMesh} from '../../../../tools/objects/terrestrial-layers/radial-terrain.mts';
const root=resolve(import.meta.dirname,'../../../../src/objects/herculina/source'),read=async (p:string):Promise<unknown>=>JSON.parse(await readFile(resolve(root,p),'utf8'));
test('Herculina preserves calibrated original coordinates and the paired spin model',async()=>{
 const {config,terrain:p,lens}=requireRadialTestConfig(await read('preparation/terrestrial.json'));const mesh=await loadPdsPlateShape(resolve(root,p.path),p.grid),t=validateClosedMesh(mesh.indices.flat(),mesh.positions);
 assert.deepEqual(mesh.positions[0],[-8005.459999999999,5312.4529999999995,70885.724]);assert.deepEqual(mesh.indices[0],[0,1,2]);assert.deepEqual([t.vertices,t.faces,t.components,t.eulerCharacteristic],[402,800,1,2]);
 assert.ok(Math.abs(t.signedVolumeCubicMeters/1e9-3514536.3589627864)<.00001);const r=requireRotation(await read('preparation/rotation.json'),['periodHours','phase']);assert.equal(r.periodHours,9.404937);assert.equal(r.phase,'arbitrary-display-phase');
 assert.equal(lens.valueTransform.offset,-94.5);
 for(let i=0;i<2048;i++){const z=1-2*(i+.5)/2048,phi=i*137.50776405003785*Math.PI/180,d=[Math.sqrt(1-z*z)*Math.cos(phi),Math.sqrt(1-z*z)*Math.sin(phi),z],hit=mesh.intersect([0,0,0],d);assert.ok(hit);assert.equal(mesh.intersect(d.map(v=>v*(hit.radius+.001)),d),null);}
});
test('Herculina keeps closed source connectivity at 800 native raster leaves',async()=>{
 const {config}=requireRadialTestConfig(await read('preparation/terrestrial.json'));const source=await createSourceManifest({planetId:'herculina',planetName:'Herculina',sourceRoot:root}),r=requireClosedRadialTerrain(await loadRadialTerrain({config,sourceDirectory:root,source}));
 assert.equal(r.faces.length,800);assert.equal(r.simplification.sourceFaces,800);assert.equal(r.simplification.removedOppositeFaces,0);assert.equal(r.simplification.topology.eulerCharacteristic,2);assert.ok(r.leaves.every(l=>l.tag==='u'&&l.attributes['data-polycss-texture-leaf-sizing']==='raster'));assert.ok(r.plans.reduce((sum,p)=>sum+p.rect.width*p.rect.height,0)<=16384*r.faces.length);
 assert.equal(r.simplification.estimatedErrorMeters,0);
 const canonical=(faces:readonly (readonly (readonly number[])[])[])=>faces.map(f=>f.map(v=>v.join(',')).sort().join(';')).sort();
 const {indices,positions}=r.grid;assert.ok(indices);assert.ok(positions);
 const scale=config.geometry.radius/(config.geometry.radiusKm*1000);
 assert.deepEqual(canonical(r.faces.map(f=>f.vertices)),canonical(indices.map(f=>f.map(i=>positions[i].map(v=>v*scale)))));
});
