import {SHAPE_MATERIAL} from '../../../../tools/objects/terrestrial-layers/shape-material.mts';
import {required} from '../../../../tools/test-values.mts';
import assert from 'node:assert/strict';
import test from 'node:test';
import {readFile, type FileHandle} from 'node:fs/promises';
import {resolve} from 'node:path';
import {createSourceManifest} from '../../../../src/platform/source-manifest.mts';
import {readAuthoredRotation} from '../../../../tools/objects/authored-rotation.mts';
import type { PathLike } from 'node:fs';
const read=async (p: PathLike|FileHandle)=>JSON.parse(await readFile(p,'utf8'));
export function testCatalogNucleus(id: string){
 test(`${id}: retained mesh preserves the native source shape and closed topology`,async()=>{
  const root=resolve('src/objects',id),excerpt=await readFile(`${root}/source/reference/celestia.ssc`,'utf8');
  const catalogRadiusM=Number(required(excerpt.match(/^\s*Radius\s+([\d.]+)/m))[1])*1000;
  const model=await read(`${root}/source/shape/model.json`),radiusM=model.volumeEquivalentRadiusKm*1000;
  const sourceObj=await readFile(`${root}/source/shape/model.obj`,'utf8');
  const sourceVertices=sourceObj.split('\n').filter(l=>l.startsWith('v ')).map(l=>l.slice(2).split(' ').map(Number));
  const terrain=await read(`${root}/prepared/terrain.json`),config=await read(`${root}/source/preparation/terrestrial.json`);
  assert.equal(terrain.faces.length,800);assert.equal(config.geometry.radiusKm*1000,radiusM);
  const units=radiusM/config.geometry.radius,vertices=new Set<string>(),edges=new Map<string,{incidents:number;winding:number}>();let maxErrorM=0,volume=0;
  for(const f of terrain.faces){
   const ps=f.vertices.map((p: number[])=>p.map((v: number)=>v*units));
   for(let i=0;i<3;i++){
    const a=ps[i].join(','),b=ps[(i+1)%3].join(','),key=[a,b].sort().join(';');vertices.add(a);
    const e=edges.get(key)??{incidents:0,winding:0};e.incidents++;e.winding+=a<b?1:-1;edges.set(key,e);
   }
   const [a,b,c]=ps;volume+=(a[0]*(b[1]*c[2]-b[2]*c[1])+a[1]*(b[2]*c[0]-b[0]*c[2])+a[2]*(b[0]*c[1]-b[1]*c[0]))/6;
  }
  for(const key of vertices){
   const p=key.split(',').map(Number);let nearest=Infinity;
   for(const q of sourceVertices)nearest=Math.min(nearest,(p[0]-q[0])**2+(p[1]-q[1])**2+(p[2]-q[2])**2);
   maxErrorM=Math.max(maxErrorM,Math.sqrt(nearest));
  }
  assert.ok([...edges.values()].every(e=>e.incidents===2&&e.winding===0));assert.equal(vertices.size-edges.size+terrain.faces.length,2);
  assert.ok(volume>0);assert.ok(Math.abs(volume/(model.nativeExport.volume*catalogRadiusM**3)-1)<.025);
  assert.ok(maxErrorM<catalogRadiusM*.001,`Reduced vertices remain on the exported source mesh (maximum nearest-source-vertex distance ${maxErrorM} m).`);
 });
 test(`${id}: full gridded coverage, one dataset, Shadows off`,async()=>{
  const root=resolve('src/objects',id),config=await read(`${root}/source/preparation/terrestrial.json`),surfaces=await read(`${root}/prepared/surfaces.json`),content=await read(`${root}/source/content/object.json`);
  assert.equal(surfaces.surfaces.length,1);const s=surfaces.surfaces[0];assert.equal(s.missingPixels,config.raster.width*config.raster.height);assert.equal(s.appearance,SHAPE_MATERIAL.appearance);assert.equal(s.layout.faceCount,800);
  assert.equal(config.geometry.radialTerrain.sourceLighting.uniformFlood,true);
  const shadows=content.settings.controls.find((c: { name: string; })=>c.name==='shadows');assert.ok(shadows,'shadows setting');assert.equal(shadows.checked,false);
 });
 test(`${id}: source closure and fixed illustrative attitude`,async()=>{
  const root=resolve('src/objects',id),descriptor=await read(`${root}/object.json`),ref=descriptor.properties.recipe.sources.find((r: { id: string; })=>r.id==='rotation');
  const source=await createSourceManifest({planetId:id,planetName:id,sourceRoot:`${root}/source`});await source.verify();
  const a=await readAuthoredRotation(root,ref,2461286.5),b=await readAuthoredRotation(root,ref,2462286.5);assert.deepEqual(a,b);assert.equal(a.spinRateRadPerDay,0);
 });
}
