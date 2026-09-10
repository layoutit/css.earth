import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {createHash} from 'node:crypto';
import {readJsonSource, requireArray, requireFiniteNumber, requireRecord, requireString} from '../../../tools/source-values.mts';
import {validateClosedMesh} from '../../../tools/objects/terrestrial-layers/radial-terrain.mts';
const root=resolve(import.meta.dirname,'../../..');
const recordAt=(value:Record<string,unknown>,key:string,label:string):Record<string,unknown>=>requireRecord(value[key],label);
const arrayAt=(value:Record<string,unknown>,key:string,label:string):unknown[]=>requireArray(value[key],label);
const vector=(value:unknown,label:string):number[]=>requireArray(value,label).map((entry,index)=>requireFiniteNumber(entry,`${label}[${index}]`));
export async function assertAsteroidPackage(id:string, expectedLenses:readonly string[], radiusM:number):Promise<void> {
 const directory=resolve(root,'src/planets',id),read=async(path:string):Promise<Record<string,unknown>>=>requireRecord(await readJsonSource(resolve(directory,path)),`${id} ${path}`);
 const [runtime,terrain,descriptor,manifest,scene]=await Promise.all(['prepared/runtime.json','prepared/terrain.json','object.json','runtime-assets.json','prepared/scene.json'].map(read));
 const descriptorProperties=recordAt(descriptor,'properties','descriptor properties');
 assert.equal(requireFiniteNumber(recordAt(recordAt(descriptorProperties,'recipe','descriptor recipe'),'shape','descriptor shape').radiusKm,'descriptor radiusKm')*1000,radiusM);
 const controls=arrayAt(recordAt(recordAt(runtime,'controls','runtime controls'),'lenses','runtime lenses'),'controls','runtime lens controls').map((lens,index)=>requireRecord(lens,`runtime lens ${index}`));
 assert.deepEqual(controls.map(lens=>lens.id),expectedLenses);
 const nodes=arrayAt(recordAt(runtime,'tree','runtime tree'),'nodes','runtime tree nodes').map((node,index)=>requireRecord(node,`runtime node ${index}`));
 assert.equal(nodes.filter(node=>typeof node.className==='string'&&node.className.includes('polycss-camera')).length,1);
 const faces=arrayAt(terrain,'faces','terrain faces').map((face,index)=>requireRecord(face,`terrain face ${index}`));
 const triangles=arrayAt(recordAt(runtime,'surfaceHit','runtime surface hit'),'triangles','runtime surface triangles');
 assert.equal(triangles.length,faces.length);
 assert.ok(faces.length<=800);
 const leaves=arrayAt(scene,'bodyLeaves','scene body leaves').map((leaf,index)=>requireRecord(leaf,`scene body leaf ${index}`));
 assert.equal(leaves.length,faces.length);
 const positions:number[][]=[],lookup=new Map<string,number>(),indices:number[]=[];
 for(const[index,face]of faces.entries()){
  const leaf=leaves[index];assert.equal(leaf.tag,'u');assert.equal(recordAt(leaf,'attributes','scene leaf attributes')['data-polycss-texture-leaf-sizing'],'raster');
  assert.equal(leaf.projectiveTextureLayer,undefined);assert.ok(typeof leaf.style==='string'&&leaf.style.includes('--polycss-atlas-width:128px'));
  const hit=requireArray(triangles[index],`runtime triangle ${index}`);
  for(const[j,value]of arrayAt(face,'vertices',`terrain face ${index} vertices`).entries()){
   const point=vector(value,`terrain vertex ${index}:${j}`);
   assert.deepEqual(vector(hit[j],`runtime triangle ${index}:${j}`),[point[1]*50,point[0]*50,point[2]*50]);
   const key=point.join(',');if(!lookup.has(key)){lookup.set(key,positions.length);positions.push(point);}indices.push(lookup.get(key)!);
  }
 }
 const topology=validateClosedMesh(indices,positions);assert.equal(topology.components,1);assert.equal(topology.eulerCharacteristic,2);
 const context=requireRecord(await readJsonSource(resolve(root,'src/planets/sun/prepared/world-context.json')),'world context'),body=arrayAt(context,'bodies','world context bodies').map((entry,index)=>requireRecord(entry,`world context body ${index}`)).find(entry=>entry.id===id);
 assert.ok(body, 'Asteroid is reachable through the application context');assert.equal(body.radiusM,radiusM);
 assert.deepEqual(body.positionM,recordAt(descriptorProperties,'worldFrame','world frame').originM);
 const assets=arrayAt(manifest,'assets','runtime assets').map((asset,index)=>requireRecord(asset,`runtime asset ${index}`));
 for(const asset of assets){const filename=requireString(asset.filename,'runtime asset filename'),bytes=await readFile(resolve(root,'public/scenes',id,filename));assert.equal(bytes.length,requireFiniteNumber(asset.bytes,`runtime asset ${filename} bytes`));assert.equal(createHash('sha256').update(bytes).digest('hex'),requireString(asset.sha256,`runtime asset ${filename} hash`));}
 const descriptorId=requireString(descriptor.id,'descriptor id');
 for(const lensId of expectedLenses){const flood=assets.find(asset=>asset.filename===`${descriptorId}-${lensId}-surface@2x.webp`),shadow=assets.find(asset=>asset.filename===`${descriptorId}-${lensId}-shadow@2x.webp`);assert.ok(flood&&shadow);assert.notEqual(flood.sha256,shadow.sha256,'Directional lighting must have distinct prepared texels');}
}
