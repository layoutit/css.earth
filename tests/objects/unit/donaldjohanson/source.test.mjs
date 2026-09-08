import assert from 'node:assert/strict';
import {test} from 'node:test';
import {readFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {createSourceManifest} from '../../../../src/platform/source-manifest.mjs';
import {readAuthoredRotation} from '../../../../tools/objects/authored-rotation.mjs';
import {loadObjShape} from '../../../../tools/objects/terrestrial-layers/obj-shape.mjs';
import {loadRadialTerrain} from '../../../../tools/objects/terrestrial-layers/radial-terrain.mjs';
const root=resolve(import.meta.dirname,'../../../../src/planets/donaldjohanson/source');
const read=async path=>JSON.parse(await readFile(resolve(root,path),'utf8'));
test('Donaldjohanson retains original source pins and DSK acquisition closure',async()=>{
 const source=await createSourceManifest({planetId:'donaldjohanson',planetName:'Donaldjohanson',sourceRoot:root});await source.verify();
 const plan=await read('preparation/acquisition.json');
 for(const input of source.manifest.inputs)if(!input.path.endsWith('.obj.gz')&&!['preparation/camera.json','observations/llorri-camera.json'].includes(input.path))assert.ok(plan.operations.some(step=>step.path===input.path));
 const dsk=await read('reference/dsk-inspection.json');assert.deepEqual([dsk.center,dsk.frame,dsk.surface,dsk.type],[20052246,20052246,200522461,2]);
});
test('Donaldjohanson preserves the Lucy mesh scale and withholds ambiguous radial elevation',async()=>{
 const config=await read('preparation/terrestrial.json'),p=config.geometry.radialTerrain;
 const mesh=await loadObjShape(resolve(root,p.path),p.grid);
 assert.deepEqual([mesh.vertices,mesh.faces],[274000,547996]);assert.deepEqual(mesh.positions[0],[3.5343599324631003,-13.500515735165198,-1315.900964425746]);assert.deepEqual(mesh.indices[0],[0,2,5]);
 const extents=mesh.bounds[1].map((v,i)=>(v-mesh.bounds[0][i])/1000);for(const[i,expected]of[8.821631717505912,4.4112336571227555,3.09636843889667].entries())assert.ok(Math.abs(extents[i]-expected)<1e-9);
 assert.deepEqual(config.raster.scientific,[]);assert.deepEqual(config.raster.shapeViews.map(v=>v.id),['shape']);
 const rotation=await read('preparation/rotation.json');assert.equal(rotation.schema,'cssearth-display-orientation@1');assert.equal(rotation.periodHours,undefined);
 const descriptor=JSON.parse(await readFile(resolve(root,'../object.json'),'utf8'));const frame=await readAuthoredRotation(resolve(root,'..'),descriptor.properties.recipe.sources.find(s=>s.id==='rotation'),2461286.5);assert.equal(frame.spinRateRadPerDay,0);
});
test('Donaldjohanson keeps the closed Lucy surface within the retained raster budget',async()=>{
 const config=await read('preparation/terrestrial.json'),source=await createSourceManifest({planetId:'donaldjohanson',planetName:'Donaldjohanson',sourceRoot:root});
 const radial=await loadRadialTerrain({config,sourceDirectory:root,source});
 assert.equal(radial.faces.length,800);assert.equal(radial.simplification.sourceFaces,547996);assert.equal(radial.simplification.removedOppositeFaces,0);
 assert.equal(radial.simplification.topology.eulerCharacteristic,2);assert.equal(radial.simplification.topology.components,1);assert.ok(radial.simplification.estimatedErrorMeters<=56);
 assert.ok(radial.leaves.every(l=>l.tag==='u'&&l.attributes['data-polycss-texture-leaf-sizing']==='raster'));
 assert.deepEqual([radial.tileSize,radial.width,radial.height],[128,2048,6400]);
});
