import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {createHash} from 'node:crypto';
import {validateClosedMesh} from '../../../tools/objects/terrestrial-layers/radial-terrain.mts';
const root=resolve(import.meta.dirname,'../../..');
export async function assertAsteroidPackage(id, expectedLenses, radiusM) {
 const directory=resolve(root,'src/planets',id),read=async path=>JSON.parse(await readFile(resolve(directory,path)));
 const [runtime,terrain,descriptor,manifest,scene]=await Promise.all(['prepared/runtime.json','prepared/terrain.json','object.json','runtime-assets.json','prepared/scene.json'].map(read));
 assert.equal(descriptor.properties.recipe.shape.radiusKm*1000,radiusM);
 assert.deepEqual(runtime.controls.lenses.controls.map(l=>l.id),expectedLenses);
 assert.equal(runtime.tree.nodes.filter(n=>n.className?.includes('polycss-camera')).length,1);
 assert.equal(runtime.surfaceHit.triangles.length,terrain.faces.length);
 assert.ok(terrain.faces.length<=800);
 assert.equal(scene.bodyLeaves.length,terrain.faces.length);
 const positions=[],lookup=new Map(),indices=[];
 for(const[index,face]of terrain.faces.entries()){
  const leaf=scene.bodyLeaves[index];assert.equal(leaf.tag,'u');assert.equal(leaf.attributes['data-polycss-texture-leaf-sizing'],'raster');
  assert.equal(leaf.projectiveTextureLayer,undefined);assert.ok(leaf.style.includes('--polycss-atlas-width:128px'));
  const hit=runtime.surfaceHit.triangles[index];
  for(const[j,v]of face.vertices.entries()){
   assert.deepEqual(hit[j],[v[1]*50,v[0]*50,v[2]*50]);
   const key=v.join(',');if(!lookup.has(key)){lookup.set(key,positions.length);positions.push(v);}indices.push(lookup.get(key));
  }
 }
 const topology=validateClosedMesh(indices,positions);assert.equal(topology.components,1);assert.equal(topology.eulerCharacteristic,2);
 const context=JSON.parse(await readFile(resolve(root,'src/planets/sun/prepared/world-context.json'))),body=context.bodies.find(b=>b.id===id);
 assert.ok(body, 'Asteroid is reachable through the application context');assert.equal(body.radiusM,radiusM);
 assert.deepEqual(body.positionM,descriptor.properties.worldFrame.originM);
 for(const asset of manifest.assets){const bytes=await readFile(resolve(root,'public/scenes',id,asset.filename));assert.equal(bytes.length,asset.bytes);assert.equal(createHash('sha256').update(bytes).digest('hex'),asset.sha256);}
 for(const id of expectedLenses){const flood=manifest.assets.find(a=>a.filename===`${descriptor.id}-${id}-surface@2x.webp`),shadow=manifest.assets.find(a=>a.filename===`${descriptor.id}-${id}-shadow@2x.webp`);assert.ok(flood&&shadow);assert.notEqual(flood.sha256,shadow.sha256,'Directional lighting must have distinct prepared texels');}
}
