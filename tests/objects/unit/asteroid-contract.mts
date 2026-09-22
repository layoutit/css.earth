import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {createHash} from 'node:crypto';
import {readJsonSource, requireArray, requireFiniteNumber, requireRecord, requireString} from '../../../tools/sources/source-values.mts';
import {validateClosedMesh} from '../../../tools/objects/terrestrial-layers/radial-terrain.mts';
const root=resolve(import.meta.dirname,'../../..');
const recordAt=(value:Record<string,unknown>,key:string,label:string):Record<string,unknown>=>requireRecord(value[key],label);
const arrayAt=(value:Record<string,unknown>,key:string,label:string):unknown[]=>requireArray(value[key],label);
const vector=(value:unknown,label:string):number[]=>requireArray(value,label).map((entry,index)=>requireFiniteNumber(entry,`${label}[${index}]`));
export async function assertAsteroidPackage(id:string, expectedLenses:readonly string[], radiusM:number):Promise<void> {
 const directory=resolve(root,'src/objects',id),read=async(path:string):Promise<Record<string,unknown>>=>requireRecord(await readJsonSource(resolve(directory,path)),`${id} ${path}`);
 const [runtime,terrain,descriptor,manifest,scene]=await Promise.all(['prepared/runtime.json','prepared/terrain.json','object.json','runtime-assets.json','prepared/scene.json'].map(read));
 const descriptorProperties=recordAt(descriptor,'properties','descriptor properties');
 assert.equal(requireFiniteNumber(recordAt(recordAt(descriptorProperties,'recipe','descriptor recipe'),'shape','descriptor shape').radiusKm,'descriptor radiusKm')*1000,radiusM);
 const controls=arrayAt(recordAt(recordAt(runtime,'controls','runtime controls'),'lenses','runtime lenses'),'controls','runtime lens controls').map((lens,index)=>requireRecord(lens,`runtime lens ${index}`));
 assert.deepEqual(controls.map(lens=>lens.id),expectedLenses);
 const nodes=arrayAt(recordAt(runtime,'tree','runtime tree'),'nodes','runtime tree nodes').map((node,index)=>requireRecord(node,`runtime node ${index}`));
 assert.equal(nodes.filter(node=>typeof node.className==='string'&&node.className.includes('polycss-camera')).length,1);
 const faces=arrayAt(terrain,'faces','terrain faces').map((face,index)=>requireRecord(face,`terrain face ${index}`));
 const triangles=arrayAt(recordAt(runtime,'surfaceHit','runtime surface hit'),'triangles','runtime surface triangles');
 const ranges=runtime.surfaceHit && recordAt(runtime,'surfaceHit','runtime surface hit').lensRanges;
 const modelRanges = ranges === undefined ? [{start:0,count:faces.length}] : [...new Map(requireArray(ranges,'surface lens ranges').map(value=>{
  const range=requireRecord(value,'surface lens range'),start=requireFiniteNumber(range.start),count=requireFiniteNumber(range.count);
  assert.ok(Number.isInteger(start)&&start>=0&&Number.isInteger(count)&&count>0&&count<=800);
  assert.ok(expectedLenses.includes(requireString(range.lensId)));
  return [`${start}:${count}`,{start,count}] as const;
 })).values()].sort((a,b)=>a.start-b.start);
 assert.deepEqual(modelRanges[0],{start:0,count:faces.length});
 let total=0;for(const range of modelRanges){assert.equal(range.start,total);total+=range.count;}assert.equal(triangles.length,total);
 assert.ok(faces.length<=800);
 const leaves=arrayAt(scene,'bodyLeaves','scene body leaves').map((leaf,index)=>requireRecord(leaf,`scene body leaf ${index}`));
 assert.equal(leaves.length,triangles.length);
 for(const leaf of leaves){assert.equal(leaf.tag,'u');assert.equal(recordAt(leaf,'attributes','scene leaf attributes')['data-polycss-texture-leaf-sizing'],'raster');}
 for(const range of modelRanges.slice(1)){
  const points:number[][]=[],ids:number[]=[],keys=new Map<string,number>();
  for(const triangle of triangles.slice(range.start,range.start+range.count))for(const vertex of requireArray(triangle,'alternate model triangle')){
   // Surface-hit coordinates swap source x/y, reversing handedness.
   const hit=vector(vertex,'alternate model vertex'),point=[hit[1],hit[0],hit[2]],key=point.join(',');
   if(!keys.has(key)){keys.set(key,points.length);points.push(point);}ids.push(keys.get(key)!);
  }
  const closed=validateClosedMesh(ids,points);assert.equal(closed.components,1);assert.equal(closed.eulerCharacteristic,2);
 }
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
 const context=requireRecord(await readJsonSource(resolve(root,'src/objects/sun/prepared/world-context.json')),'world context'),body=arrayAt(context,'bodies','world context bodies').map((entry,index)=>requireRecord(entry,`world context body ${index}`)).find(entry=>entry.id===id);
 assert.ok(body, 'Asteroid is reachable through the application context');assert.equal(body.radiusM,radiusM);
 assert.deepEqual(body.positionM,recordAt(descriptorProperties,'worldFrame','world frame').originM);
 const assets=arrayAt(manifest,'assets','runtime assets').map((asset,index)=>requireRecord(asset,`runtime asset ${index}`));
 for(const asset of assets){const filename=requireString(asset.filename,'runtime asset filename'),bytes=await readFile(resolve(root,'public/scenes',id,filename));assert.equal(bytes.length,requireFiniteNumber(asset.bytes,`runtime asset ${filename} bytes`));assert.equal(createHash('sha256').update(bytes).digest('hex'),requireString(asset.sha256,`runtime asset ${filename} hash`));}
 const descriptorId=requireString(descriptor.id,'descriptor id');
 // A photograph lens that keeps its acquisition illumination is never lit again, so it has no epoch-lit shadow atlas.
 const recipe=requireRecord(await readJsonSource(resolve(root,'src/objects',id,'source/preparation/terrestrial.json')),'terrestrial recipe'),observations=recordAt(recipe,'raster','raster').surfaceObservations;
 const retained=new Set((Array.isArray(observations)?observations:[]).map(value=>requireRecord(value,'surface observation')).filter(lens=>requireRecord(lens.photometry,'photometry').model==='retained-observation').map(lens=>requireString(lens.id,'lens id')));
 for(const lensId of expectedLenses){const flood=assets.find(asset=>asset.filename===`${descriptorId}-${lensId}-surface@2x.webp`),shadow=assets.find(asset=>asset.filename===`${descriptorId}-${lensId}-shadow@2x.webp`);assert.ok(flood);if(retained.has(lensId)){assert.equal(shadow,undefined,`${lensId} keeps its acquisition illumination and has no shadow atlas`);continue;}assert.ok(shadow);assert.notEqual(flood.sha256,shadow.sha256,'Directional lighting must have distinct prepared texels');}
}
