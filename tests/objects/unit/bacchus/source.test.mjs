import assert from 'node:assert/strict';
import {test} from 'node:test';
import {readFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {createSourceManifest} from '../../../../src/platform/source-manifest.mts';
import {loadObjShape,createShapeSurfaceSampler} from '../../../../tools/objects/terrestrial-layers/obj-shape.mts';
import {loadRadialTerrain,validateClosedMesh} from '../../../../tools/objects/terrestrial-layers/radial-terrain.mts';
const root=resolve(import.meta.dirname,'../../../../src/planets/bacchus/source');
const read=async path=>JSON.parse(await readFile(resolve(root,path),'utf8'));
test('Bacchus retains original source pins and acquisition closure',async()=>{
 const source=await createSourceManifest({planetId:'bacchus',planetName:'Bacchus',sourceRoot:root});await source.verify();
 const plan=await read('preparation/acquisition.json');
 for(const input of source.manifest.inputs)assert.ok(plan.operations.some(step=>step.path===input.path));
});
test('Bacchus preserves the original kilometer mesh and published spin interpretation',async()=>{
 const config=await read('preparation/terrestrial.json'),p=config.geometry.radialTerrain;
 const mesh=await loadObjShape(resolve(root,p.path),p.grid),topology=validateClosedMesh(mesh.indices.flat(),mesh.positions);
 assert.deepEqual(mesh.positions[0],[0,0,203.03]);
 assert.deepEqual(mesh.indices[0],[0,1,2]);
 assert.deepEqual([topology.vertices,topology.faces,topology.components,topology.eulerCharacteristic],[256,508,1,2]);
 assert.ok(Math.abs(topology.signedVolumeCubicMeters/1e9-0.1312520820552817)<.00001);
 const rotation=await read('preparation/rotation.json');assert.equal(rotation.periodHours,15);assert.equal(rotation.phase,'arbitrary-display-phase');
 assert.equal(config.geometry.radiusKm,0.315);assert.equal(config.raster.scientific[0].valueTransform.offset,-0.315);

});
test('Bacchus keeps a closed source-connected mesh within the retained raster budget',async()=>{
 const config=await read('preparation/terrestrial.json'),source=await createSourceManifest({planetId:'bacchus',planetName:'Bacchus',sourceRoot:root});
 const radial=await loadRadialTerrain({config,sourceDirectory:root,source});
 assert.equal(radial.faces.length,508);assert.equal(radial.simplification.sourceFaces,508);assert.equal(radial.simplification.removedOppositeFaces,0);
 assert.equal(radial.simplification.topology.eulerCharacteristic,2);assert.ok(radial.simplification.estimatedErrorMeters<=1);
 assert.ok(radial.leaves.every(l=>l.tag==='u'&&l.attributes['data-polycss-texture-leaf-sizing']==='raster'));
 assert.deepEqual([radial.tileSize,radial.width,radial.height],[128,2048,4096]);
});

test('Bacchus radius colors match independent full-source projections',async()=>{
 const config=await read('preparation/terrestrial.json'),p=config.geometry.radialTerrain,lens=config.raster.scientific[0],mesh=await loadObjShape(resolve(root,p.path),p.grid),sample=createShapeSurfaceSampler(mesh,lens);
 const anchors=JSON.parse(await readFile(new URL('./scalar-anchors.json',import.meta.url)));
 assert.equal(lens.surfaceSampling.method,'closest-source-point');
 const manifest=await read('manifest.json');assert.equal(anchors.sourceSha256,manifest.inputs.find(i=>i.path===p.path).expectedSha256);
 for(const check of anchors.checks){const value=sample.samplePoint(check.query);if(!check.withinTransferLimit){assert.equal(value,null);continue;}assert.ok(value,check.kind);assert.ok(Math.abs(value.value-check.expectedValue)<1e-9,check.kind);assert.ok(Math.abs(value.radius-check.expectedRadiusMeters)<1e-6,check.kind);assert.ok(value.point.every((n,i)=>Math.abs(n-check.expectedPoint[i])<1e-6),check.kind);}
 
});
