import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile,readdir} from 'node:fs/promises';
import {resolve} from 'node:path';
import {SCENE_OBJECTS} from '../../site/objects.mts';
import {projectRoot} from './fixtures.mts';
import type { PathLike } from 'node:fs';
const selected=SCENE_OBJECTS;
assert.ok(selected.length>0,'The registry must exercise source closure.');
const executable=/\.(?:[cm]?[jt]sx?|astro|css)$/i;
async function files(root: string):Promise<string[]>{const result=[];for(const entry of await readdir(root,{withFileTypes:true})){const path=resolve(root,entry.name);if(entry.isDirectory())result.push(...await files(path));else {assert.ok(entry.isFile(),`Unexpected non-file ${path}`);result.push(path);}}return result;}
for(const {id} of selected){
 test(`${id}: authored object directory contains data and pinned sources only`,async()=>{
  const root=resolve(projectRoot,'src/objects',id),entries=await readdir(root,{withFileTypes:true});
  for(const entry of entries)assert.ok(entry.isDirectory()?['source','prepared','evidence'].includes(entry.name):(['.gitignore','.gitattributes'].includes(entry.name)||entry.name.endsWith('.json')||/^(?:README|NOTICE|LICENSE)(?:[._-].*)?$/.test(entry.name)),`Executable/presentation owner leaked into object data: ${id}/${entry.name}`);
  const prepared=await files(resolve(root,'prepared'));
  assert.ok(prepared.length>0,`Prepared data is missing: ${id}/prepared`);
  for(const path of await files(root))assert.equal(executable.test(path),false,`Object-specific executable remains: ${path}`);
 });
 test(`${id}: every pinned source is declared and byte-verified`,async()=>{
  const {parseSourceManifest,verifySources}=await import('../../tools/objects/dist/operations.js');
  const sourceRoot=resolve(projectRoot,'src/objects',id,'source');const manifest=parseSourceManifest(JSON.parse(await readFile(resolve(sourceRoot,'manifest.json'),'utf8')),id);
  const result=await verifySources({sourceRoot,manifest});assert.ok(result.verifiedCount>0);
 });
 test(`${id}: compiled runtime asset manifest equals the canonical public closure`,async()=>{
  const {parseRuntimeManifest}=await import('../../tools/objects/dist/operations.js');
  const manifest=parseRuntimeManifest(JSON.parse(await readFile(resolve(projectRoot,'src/objects',id,'inventory.json'),'utf8')),id);
  const root=resolve(projectRoot,'public/scenes',id);assert.deepEqual((await readdir(root)).sort(),manifest.assets.map(asset=>asset.filename).sort());
  const {createHash}=await import('node:crypto');for(const asset of manifest.assets){const bytes=await readFile(resolve(root,asset.filename));assert.equal(bytes.length,asset.bytes);assert.equal(createHash('sha256').update(bytes).digest('hex'),asset.sha256);}
 });
}
