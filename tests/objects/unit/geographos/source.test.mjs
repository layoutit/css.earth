import assert from 'node:assert/strict';
import {test} from 'node:test';
import {readFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {createSourceManifest} from '../../../../src/platform/source-manifest.mjs';
import {loadObjShape,createShapeSurfaceSampler} from '../../../../tools/objects/terrestrial-layers/obj-shape.mjs';
import {loadRadialTerrain,validateClosedMesh} from '../../../../tools/objects/terrestrial-layers/radial-terrain.mjs';
const root=resolve(import.meta.dirname,'../../../../src/planets/geographos/source');
const read=async path=>JSON.parse(await readFile(resolve(root,path),'utf8'));
test('Geographos retains original source pins and acquisition closure',async()=>{
 const source=await createSourceManifest({planetId:'geographos',planetName:'Geographos',sourceRoot:root});await source.verify();
 const plan=await read('preparation/acquisition.json');
 for(const input of source.manifest.inputs)assert.ok(plan.operations.some(step=>step.path===input.path));
});
test('Geographos preserves the original kilometer mesh and published spin interpretation',async()=>{
 const config=await read('preparation/terrestrial.json'),p=config.geometry.radialTerrain;
 const mesh=await loadObjShape(resolve(root,p.path),p.grid),topology=validateClosedMesh(mesh.indices.flat(),mesh.positions);
 assert.deepEqual(mesh.positions[0],[0,0,807.763]);
 assert.deepEqual(mesh.indices[0],[0,863,988]);
 assert.deepEqual([topology.vertices,topology.faces,topology.components,topology.eulerCharacteristic],[2048,4092,1,2]);
 assert.ok(Math.abs(topology.signedVolumeCubicMeters/1e9-8.868010549153729)<.00001);
 const rotation=await read('preparation/rotation.json');assert.equal(rotation.periodHours,5.223327);assert.equal(rotation.phase,'arbitrary-display-phase');
 assert.equal(config.geometry.radiusKm,1.284042);assert.equal(config.raster.scientific[0].valueTransform.offset,-1.284042);

});
test('Geographos keeps a closed source-connected mesh within the retained raster budget',async()=>{
 const config=await read('preparation/terrestrial.json'),source=await createSourceManifest({planetId:'geographos',planetName:'Geographos',sourceRoot:root});
 const radial=await loadRadialTerrain({config,sourceDirectory:root,source});
 assert.equal(radial.faces.length,800);assert.equal(radial.simplification.sourceFaces,4092);assert.equal(radial.simplification.removedOppositeFaces,0);
 assert.equal(radial.simplification.topology.eulerCharacteristic,2);assert.ok(radial.simplification.estimatedErrorMeters<=30);
 assert.ok(radial.leaves.every(l=>l.tag==='u'&&l.attributes['data-polycss-texture-leaf-sizing']==='raster'));
 assert.deepEqual([radial.tileSize,radial.width,radial.height],[128,2048,6400]);
});

test('Geographos radius colors match independent full-source projections',async()=>{
 const config=await read('preparation/terrestrial.json'),p=config.geometry.radialTerrain,lens=config.raster.scientific[0],mesh=await loadObjShape(resolve(root,p.path),p.grid),sample=createShapeSurfaceSampler(mesh,lens);
 const anchors=JSON.parse(await readFile(new URL('./scalar-anchors.json',import.meta.url)));
 assert.equal(lens.surfaceSampling.method,'closest-source-point');
 const manifest=await read('manifest.json');assert.equal(anchors.sourceSha256,manifest.inputs.find(i=>i.path===p.path).expectedSha256);
 for(const check of anchors.checks){const value=sample.samplePoint(check.query);if(!check.withinTransferLimit){assert.equal(value,null);continue;}assert.ok(value,check.kind);assert.ok(Math.abs(value.value-check.expectedValue)<1e-9,check.kind);assert.ok(Math.abs(value.radius-check.expectedRadiusMeters)<1e-6,check.kind);assert.ok(value.point.every((n,i)=>Math.abs(n-check.expectedPoint[i])<1e-6),check.kind);}
 assert.ok(anchors.checks.filter(c=>c.kind==='radial-ambiguity').some(c=>Math.abs(c.expectedValue-c.oldFirstRayValue)>.07));
});
