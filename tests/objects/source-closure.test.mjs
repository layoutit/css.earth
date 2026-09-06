import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile,readdir,access} from 'node:fs/promises';
import {resolve} from 'node:path';
import {OBJECTS} from '../../site/objects.mjs';
import {projectRoot} from './fixtures.mjs';
const exists=async path=>{try{await access(path);return true;}catch{return false;}};
const selected=[];
for(const object of OBJECTS)if(await exists(resolve(projectRoot,'src/planets',object.id,'source/preparation/raster.json')))selected.push(object);
assert.ok(selected.length>0,'At least one authored raster object must exercise source closure.');
const executable=/\.(?:mjs|cjs|[jt]sx?|astro|css)$/i;
async function files(root){const result=[];for(const entry of await readdir(root,{withFileTypes:true})){const path=resolve(root,entry.name);if(entry.isDirectory())result.push(...await files(path));else {assert.ok(entry.isFile(),`Unexpected non-file ${path}`);result.push(path);}}return result;}
for(const {id} of selected){
 test(`${id}: authored object directory contains JSON and pinned sources only`,async()=>{
  const root=resolve(projectRoot,'src/planets',id),entries=await readdir(root,{withFileTypes:true});
  for(const entry of entries)assert.ok(entry.isDirectory()?entry.name==='source':(entry.name.endsWith('.json')||/^(?:SOURCE|NOTICE|LICENSE)(?:[._-].*)?$/.test(entry.name)),`Executable/presentation owner leaked into object data: ${id}/${entry.name}`);
  for(const path of await files(root))assert.equal(executable.test(path),false,`Object-specific executable remains: ${path}`);
 });
 test(`${id}: every pinned source is declared and byte-verified`,async()=>{
  const {parseSourceManifest,verifySources}=await import('../../tools/objects/dist/operations.js');
  const sourceRoot=resolve(projectRoot,'src/planets',id,'source');const manifest=parseSourceManifest(JSON.parse(await readFile(resolve(sourceRoot,'manifest.json'),'utf8')),id);
  const result=await verifySources({sourceRoot,manifest});assert.ok(result.verifiedCount>0);
 });
 test(`${id}: compiled runtime asset manifest equals actual public closure`,async()=>{
  const {parseRuntimeManifest}=await import('../../tools/objects/dist/operations.js');
  const manifest=parseRuntimeManifest(JSON.parse(await readFile(resolve(projectRoot,'src/planets',id,'runtime-assets.json'),'utf8')),id);
  const root=resolve(projectRoot,'public/scenes',id);assert.deepEqual((await readdir(root)).sort(),manifest.assets.map(asset=>asset.filename).sort());
  const {createHash}=await import('node:crypto');for(const asset of manifest.assets){const bytes=await readFile(resolve(root,asset.filename));assert.equal(bytes.length,asset.bytes);assert.equal(createHash('sha256').update(bytes).digest('hex'),asset.sha256);}
 });
}
