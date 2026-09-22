import { sourceTest } from '../../source-test.mts';
const test = sourceTest('arrokoth');
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {parseObjShape} from '../../../../tools/objects/terrestrial-layers/obj-shape.mts';
import {readFitsPrimary} from '../../../../tools/objects/observation/fits.mts';
import {parseObjTextureCoordinates,createObjUvFitsSampler} from '../../../../tools/objects/terrestrial-layers/obj-uv-fits.mts';
const root=new URL('../../../../src/objects/arrokoth/source/',import.meta.url);
const json=async (path: string|URL)=>JSON.parse((await readFile(new URL(path,root))).toString('utf8'));
test('released Arrokoth topology retains two closed source lobes at kilometre scale',async()=>{
 const config=await json('preparation/terrestrial.json'),text=await readFile(new URL(config.geometry.radialTerrain.path,root),'utf8');
 const mesh=parseObjShape(text,config.geometry.radialTerrain.grid);
 assert.equal(mesh.positions.length,20484);assert.equal(mesh.indices.length,40960);
 const maximumRadius=Math.max(...mesh.positions.map(v=>Math.hypot(...v)));
 assert.ok(Math.abs(config.geometry.camera.framingScale-config.geometry.radiusKm*1000/maximumRadius)<1e-12);
 for(const [axis,extent]of [34545.648,19838.242,13822.347].entries())assert.ok(Math.abs(mesh.bounds[1][axis]-mesh.bounds[0][axis]-extent)<1e-6);
 const edges=new Map(),parents=mesh.positions.map((_,i)=>i),find=(i: number):number=>parents[i]===i?i:(parents[i]=find(parents[i]));
 for(const face of mesh.indices)for(let i=0;i<3;i++){
  const a=face[i],b=face[(i+1)%3],key=[Math.min(a,b),Math.max(a,b)].join(':');edges.set(key,(edges.get(key)??0)+1);parents[find(b)]=find(a);
 }
 assert.ok([...edges.values()].every(n=>n===2));assert.equal(new Set(parents.map((_,i)=>find(i))).size,2);
 assert.equal(mesh.positions.length-edges.size+mesh.indices.length,4);
 assert.equal(config.geometry.radialTerrain.simplification.method,'source-meshoptimizer');
});
test('Arrokoth UV orientation matches independently decoded released PNG scalar anchors',async()=>{
 const config=await json('preparation/terrestrial.json'),lens=config.raster.scientific[0];
 const receipt=JSON.parse((await readFile(new URL('../../fixtures/arrokoth/arrokoth-registration.json',import.meta.url))).toString('utf8'));
 const bytes=await readFile(new URL(lens.path,root)),fits=readFitsPrimary(bytes);
 assert.equal(createHash('sha256').update(bytes).digest('hex'),receipt.sourceFitsSha256);
 const png=await readFile(new URL('science/albedo_arrokoth4_fp36h2_masked1.png',root));
 assert.equal(createHash('sha256').update(png).digest('hex'),receipt.sourcePngSha256);
 assert.equal(lens.grid.flipV,false);
 let wrongOrientationError=0;
 for(const anchor of receipt.samples){
  const [x,y]=anchor.pngPixel,expected=anchor.integer/1361975.975+.03188;
  assert.ok(Math.abs(fits.values[(1199-y)*600+x]-expected)<3e-6);
  wrongOrientationError+=Math.abs(fits.values[y*600+x]-expected);
 }
 assert.ok(wrongOrientationError/receipt.samples.length>.001);
 const text=await readFile(new URL(lens.meshPath,root),'utf8'),mesh=parseObjShape(text,config.geometry.radialTerrain.grid),mapping=parseObjTextureCoordinates(text,mesh);
 const sampler=createObjUvFitsSampler(mesh,mapping,fits,lens);
 // Original face centroids identify their own UV island; both lobes are sampled.
 for(const faceId of [100,21000]){
  const point=[0,1,2].map(axis=>mesh.indices[faceId].reduce((s,i)=>s+mesh.positions[i][axis]/3,0));
  const sample=sampler.samplePoint(point);assert.ok(sample);assert.equal(sample.faceId,faceId);
  for(const axis of [0,1])assert.ok(Math.abs(sample.uv[axis]-mapping.faces[faceId].reduce((s,i)=>s+mapping.uv[i][axis]/3,0))<1e-8);
 }
 assert.equal(lens.grid.noData,undefined,'the uniform source baseline is not an inferred observation mask');
 const content=await json('content/object.json');assert.equal(content.lenses.defaultLens,'lorri');
 assert.match(content.lenses.controls.find((l: { id: string; })=>l.id==='albedo').notes,/unconstrained model fill/);
 assert.ok(content.settings.controls.filter((c: { name: string; })=>['shadows','orbit'].includes(c.name)).every((c: { checked: boolean; })=>c.checked===false));
});
