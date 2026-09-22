import {array,number,shape,text} from '../../../../tools/objects/terrestrial-layers/source-records.mts';
import {requireClosedTerrain} from '../../fixtures/source-fixture.mts';
import {required} from '../../../../tools/contract/test-values.mts';
import assert from 'node:assert/strict';
import {test} from 'node:test';
import {readFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {createSourceManifest} from '../../../../src/platform/source-manifest.mts';
import {loadObjShape,createShapeSurfaceSampler} from '../../../../tools/objects/terrestrial-layers/obj-shape.mts';
import {loadRadialTerrain,validateClosedMesh} from '../../../../tools/objects/terrestrial-layers/radial-terrain.mts';
const root=resolve(import.meta.dirname,'../../../../src/objects/asteroid-1996-hw1/source');
const read=async (path: string)=>JSON.parse(await readFile(resolve(root,path),'utf8'));
test('1996 HW1 retains original source pins and acquisition closure',async()=>{
 const source=await createSourceManifest({planetId:'asteroid-1996-hw1',planetName:'1996 HW1',sourceRoot:root});await source.verify();
 const plan=await read('preparation/acquisition.json');
 for(const input of source.manifest.inputs)assert.ok(plan.operations.some((step: { path: string; })=>step.path===input.path));
});
test('1996 HW1 preserves the original kilometer mesh and published spin interpretation',async()=>{
 const config=await read('preparation/terrestrial.json'),p=config.geometry.radialTerrain;
 const mesh=await loadObjShape(resolve(root,p.path),p.grid),topology=validateClosedMesh(mesh.indices.flat(),mesh.positions);
 assert.deepEqual(mesh.positions[0],[604.155,25.593999999999998,741.02]);
 assert.deepEqual(mesh.indices[0],[0,1,2]);
 assert.deepEqual([topology.vertices,topology.faces,topology.components,topology.eulerCharacteristic],[1392,2780,1,2]);
 assert.ok(Math.abs(topology.signedVolumeCubicMeters/1e9-4.336113147211365)<.00001);
 const rotation=await read('preparation/rotation.json');assert.equal(rotation.periodHours,8.76243);assert.equal(rotation.phase,'arbitrary-display-phase');
 assert.equal(config.geometry.radiusKm,1.01);assert.equal(config.raster.scientific[0].valueTransform.offset,-1.01);

});
test('1996 HW1 keeps a closed source-connected mesh within the retained raster budget',async()=>{
 const config=await read('preparation/terrestrial.json'),source=await createSourceManifest({planetId:'asteroid-1996-hw1',planetName:'1996 HW1',sourceRoot:root});
 const radial=requireClosedTerrain(await loadRadialTerrain({config,sourceDirectory:root,source}));
 assert.equal(radial.faces.length,800);assert.equal(required(radial.simplification).sourceFaces,2780);assert.equal(required(radial.simplification).removedOppositeFaces,0);
 assert.equal(required(radial.simplification).topology.eulerCharacteristic,2);assert.ok(required(radial.simplification).estimatedErrorMeters<=26);
 assert.ok(radial.leaves.every(l=>l.tag==='u'&&l.attributes['data-polycss-texture-leaf-sizing']==='raster'));
 assert.ok(radial.plans.reduce((sum,p)=>sum+p.rect.width*p.rect.height,0)<=16384*radial.faces.length);
});

test('1996 HW1 radius colors match independent full-source projections',async()=>{
 const config=await read('preparation/terrestrial.json'),p=config.geometry.radialTerrain,lens=config.raster.scientific[0],mesh=await loadObjShape(resolve(root,p.path),p.grid),sample=createShapeSurfaceSampler(mesh,lens);
 const anchors=JSON.parse((await readFile(new URL('./scalar-anchors.json',import.meta.url))).toString('utf8'));
 const manifest=await read('manifest.json');assert.equal(anchors.sourceSha256,required(array(shape({path:text,expectedSha256:text}))(manifest.inputs).find(i=>i.path===p.path)).expectedSha256);
 for(const check of anchors.checks){const value=sample.samplePoint(check.query);if(!check.withinTransferLimit){assert.equal(value,null);continue;}assert.ok(value,check.kind);assert.ok(Math.abs(value.value-check.expectedValue)<1e-9,check.kind);assert.ok(Math.abs(value.radius-check.expectedRadiusMeters)<1e-6,check.kind);assert.ok(value.point.every((n,i)=>Math.abs(n-check.expectedPoint[i])<1e-6),check.kind);}
 assert.ok(anchors.checks.filter((c: { kind: string; })=>c.kind==='radial-ambiguity').some((c: { expectedValue: number; oldFirstRayValue: number; })=>Math.abs(c.expectedValue-c.oldFirstRayValue)>1));
});
