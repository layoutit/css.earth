import assert from 'node:assert/strict';
import {test} from 'node:test';
import {readFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {createSourceManifest} from '../../../../src/platform/source-manifest.mjs';
import {loadObjShape} from '../../../../tools/objects/terrestrial-layers/obj-shape.mjs';
import {loadRadialTerrain,validateClosedMesh} from '../../../../tools/objects/terrestrial-layers/radial-terrain.mjs';
const root=resolve(import.meta.dirname,'../../../../src/planets/dimorphos/source');
const read=async path=>JSON.parse(await readFile(resolve(root,path),'utf8'));
test('Dimorphos restores all required source inputs from pinned acquisition operations',async()=>{
 const source=await createSourceManifest({planetId:'dimorphos',planetName:'Dimorphos',sourceRoot:root});await source.verify();
 const plan=await read('preparation/acquisition.json');
 for(const input of source.manifest.inputs)assert.ok(plan.operations.some(step=>step.path===input.path));
});
test('Dimorphos retains the published DART kilometer coordinates, closed volume and original topology',async()=>{
 const config=await read('preparation/terrestrial.json'),p=config.geometry.radialTerrain,mesh=await loadObjShape(resolve(root,p.path),p.grid);
 for(const [axis,value] of [-46.509999781847,45.719999819994,37.5000014901161].entries())assert.ok(Math.abs(mesh.positions[0][axis]-value)<1e-8);
 const topology=validateClosedMesh(mesh.indices.flat(),mesh.positions);
 assert.deepEqual([topology.vertices,topology.edges,topology.faces,topology.components,topology.eulerCharacteristic],[98306,294912,196608,1,2]);
 assert.ok(Math.abs(topology.signedVolumeCubicMeters/1e9-.001759765951701106)<1e-12);
});
test('Dimorphos produces a closed retained native raster mesh within its authored budget',async()=>{
 const config=await read('preparation/terrestrial.json'),source=await createSourceManifest({planetId:'dimorphos',planetName:'Dimorphos',sourceRoot:root});
 const radial=await loadRadialTerrain({config,sourceDirectory:root,source});
 assert.equal(radial.faces.length,800);assert.equal(radial.simplification.removedOppositeFaces,0);assert.ok(radial.simplification.estimatedErrorMeters<=2);
 assert.equal(radial.simplification.topology.eulerCharacteristic,2);assert.equal(radial.simplification.topology.components,1);
 assert.ok(radial.leaves.every(leaf=>leaf.tag==='u'&&leaf.attributes['data-polycss-texture-leaf-sizing']==='raster'));
 assert.equal(radial.tileSize,128);
});
