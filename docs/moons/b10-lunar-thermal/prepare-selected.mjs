// Replay the shared static-material preparer against the accepted Moon scene.
import assert from 'node:assert/strict';
import {readFile,writeFile,mkdir,cp,copyFile,mkdtemp} from 'node:fs/promises';
import {resolve} from 'node:path';
import {createHash} from 'node:crypto';
import {createSourceManifest} from '../../../src/platform/source-manifest.mjs';
import {prepareObservationLenses} from '../../../tools/objects/static-surface/raster.mjs';
import {prepareBandSurfacePresentation} from '../../../tools/objects/static-surface/presentation.mjs';
import {prepareRuntimeManifest} from '../../../tools/objects/dist/operations.js';
import {prepareSurfaceMinimaps} from '../../../tools/prepare-surface-minimaps.mjs';
import {prepareObjectProvenance} from '../../../tools/objects/provenance.mjs';
const read=async p=>JSON.parse(await readFile(p));
const write=async(p,x)=>writeFile(p,JSON.stringify(x)+'\n');
const hash=b=>createHash('sha256').update(b).digest('hex');
const selected=new Set((await read(new URL('./selected-views.json',import.meta.url))).moon);
const objectDirectory=resolve('src/planets/moon'),sourceDirectory=resolve(objectDirectory,'source');
const frozen=await read(new URL('./source-review/baseline.json',import.meta.url));
const baseline=await read(resolve(objectDirectory,'runtime-assets.json'));
const old=await read(resolve(objectDirectory,'prepared/runtime.json'));
assert.equal(hash(await readFile(resolve(objectDirectory,'prepared/scene.json'))),frozen.files['prepared/scene.json'].sha256);
const source=await createSourceManifest({planetId:'moon',planetName:'Moon',sourceRoot:sourceDirectory});await source.verify();
await mkdir('output/b10-preparation',{recursive:true});
const stage=await mkdtemp(resolve('output/b10-preparation/moon-')),publicDirectory=resolve(stage,'public'),outputDirectory=resolve(stage,'prepared');
await mkdir(publicDirectory,{recursive:true});await cp(resolve(objectDirectory,'prepared'),outputDirectory,{recursive:true});
for(const a of baseline.assets){const path=resolve('public/scenes/moon',a.filename),bytes=await readFile(path);assert.equal(bytes.length,a.bytes);assert.equal(hash(bytes),a.sha256);await copyFile(path,resolve(publicDirectory,a.filename));}
const scene=await read(resolve(outputDirectory,'scene.json'));
const raster=await read(resolve(sourceDirectory,'preparation/raster.json')),geometry=await read(resolve(sourceDirectory,'preparation/geometry.json')),content=await read(resolve(sourceDirectory,'content/static.json'));
await prepareObservationLenses({sourceDirectory,publicDirectory,config:{...raster,lenses:raster.lenses.filter(x=>selected.has(x.id))},geometry});
const sky=await read(resolve(outputDirectory,'sky.json')),sun=await read(resolve(outputDirectory,'sun.json'));
const presentation=await prepareBandSurfacePresentation({namespace:'moon',plan:scene,lenses:content.lenses,sky,sun});
// The finalizer adds activation groups and world-camera bindings. Verify every
// raw tree field, then keep that accepted enrichment byte for byte.
for(const [key,value] of Object.entries(presentation.tree))assert.deepEqual(value,old.tree[key],'Fixed tree field differs: '+key);
for(const variant of old.variants)assert.deepEqual(presentation.variants.find(x=>x.when.lensId===variant.when.lensId),variant,'Existing lens binding differs');
const definition={...old,assets:presentation.assets,variants:presentation.variants,controls:content.controls};
for(const name of ['controls','lenses','panel'])await write(resolve(outputDirectory,name+'.json'),content[name]);
const preparedContent=await read(resolve(outputDirectory,'content.json'));preparedContent.provenance=content.provenance;preparedContent.resources=content.resources;
await write(resolve(outputDirectory,'content.json'),preparedContent);await write(resolve(outputDirectory,'runtime.json'),definition);
const authoring=await read(resolve(outputDirectory,'authored-preparation.json'));
authoring.sources=(await read(resolve(objectDirectory,'object.json'))).properties.recipe.sources;
await write(resolve(outputDirectory,'authored-preparation.json'),authoring);
const previewObject=resolve(stage,'preview-object'),previewOutput=resolve(stage,'preview-prepared');
await mkdir(resolve(previewObject,'source/preparation'),{recursive:true});await mkdir(previewOutput,{recursive:true});
const previousMinimaps=await read(resolve(outputDirectory,'minimaps.json'));
await write(resolve(previewOutput,'controls.json'),{...content.controls,lenses:{...content.controls.lenses,controls:content.controls.lenses.controls.filter(x=>selected.has(x.id))}});
await write(resolve(previewObject,'source/preparation/raster.json'),{...raster,lenses:raster.lenses.filter(x=>selected.has(x.id))});
const minimaps=await prepareSurfaceMinimaps({objectDirectory:previewObject,publicDirectory,outputDirectory:previewOutput});
await cp(resolve(previewOutput,'minimaps'),resolve(outputDirectory,'minimaps'),{recursive:true});
const combined=[...previousMinimaps.images.filter(x=>!selected.has(x.id)),...minimaps];
const order=content.controls.lenses.controls.map(x=>x.id);combined.sort((a,b)=>order.indexOf(a.id)-order.indexOf(b.id));
await write(resolve(outputDirectory,'minimaps.json'),{images:combined});
const values=[];for(const n of ['runtime','controls','content','lenses','scene','sky','sun'])values.push(await read(resolve(outputDirectory,n+'.json')));
await prepareRuntimeManifest({id:'moon',publicRoot:publicDirectory,manifestPath:resolve(outputDirectory,'runtime-assets.json'),values,allowPreparationArtifacts:true});
await prepareObjectProvenance({objectDirectory,publicDirectory,outputDirectory,basis:'prepared'});
const inventory=await read(resolve(outputDirectory,'runtime-assets.json'));
for(const a of baseline.assets){
 if([...selected].some(id=>a.filename.startsWith('moon-'+id)))continue;
 const now=inventory.assets.find(x=>x.filename===a.filename);assert.ok(now,'Unchanged asset disappeared');assert.equal(now.sha256,a.sha256,'Unchanged image differs');
}
assert.equal(hash(await readFile(resolve(outputDirectory,'scene.json'))),frozen.files['prepared/scene.json'].sha256);
for(const a of inventory.assets)await copyFile(resolve(publicDirectory,a.filename),resolve('public/scenes/moon',a.filename));
await cp(outputDirectory,resolve(objectDirectory,'prepared'),{recursive:true});
await copyFile(resolve(outputDirectory,'runtime-assets.json'),resolve(objectDirectory,'runtime-assets.json'));
await write(resolve(stage,'receipt.json'),{selected:[...selected],stage,assetCount:inventory.assets.length,sceneSha256:frozen.files['prepared/scene.json'].sha256});
console.log(stage);
