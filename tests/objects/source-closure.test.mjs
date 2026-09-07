import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile,readdir,access} from 'node:fs/promises';
import {resolve} from 'node:path';
import {execFileSync} from 'node:child_process';
import sharp from 'sharp';
import {OBJECTS} from '../../site/objects.mjs';
import {projectRoot} from './fixtures.mjs';
async function exists(path){try{await access(path);return true;}catch(error){if(error.code==='ENOENT')return false;throw error;}}
const selected=OBJECTS;
assert.ok(selected.length>0,'The registry must exercise source closure.');
const executable=/\.(?:mjs|cjs|[jt]sx?|astro|css)$/i;
async function files(root,{skipPrivateCache=false}={}){const result=[];for(const entry of await readdir(root,{withFileTypes:true})){if(skipPrivateCache&&entry.name==='.prepared')continue;const path=resolve(root,entry.name);if(entry.isDirectory())result.push(...await files(path,{skipPrivateCache}));else {assert.ok(entry.isFile(),`Unexpected non-file ${path}`);result.push(path);}}return result;}
for(const {id} of selected){
 test(`${id}: authored object directory contains data and pinned sources only`,async()=>{
  const root=resolve(projectRoot,'src/planets',id),entries=await readdir(root,{withFileTypes:true});
  for(const entry of entries){
   // Historical preparation receipts are ignored workspace state, not package
   // sources. Keep them intact; the actual runtime import closure is audited.
   if(entry.name==='.prepared'&&entry.isDirectory()){
    assert.equal(execFileSync('git',['ls-files','--',`src/planets/${id}/.prepared`],{cwd:projectRoot,encoding:'utf8'}),'');
    execFileSync('git',['check-ignore',`src/planets/${id}/.prepared/`],{cwd:projectRoot});continue;
   }
   assert.ok(entry.isDirectory()?entry.name==='source'||entry.name==='prepared':(entry.name.endsWith('.json')||/^(?:README|SOURCE|NOTICE|LICENSE)(?:[._-].*)?$/.test(entry.name)),`Executable/presentation owner leaked into object data: ${id}/${entry.name}`);
  }
  const prepared=await files(resolve(root,'prepared'));
  assert.ok(prepared.length>0,`Prepared data is missing: ${id}/prepared`);
  const mapFile=resolve(root,'prepared/minimaps.json');
  const maps=await exists(mapFile)?JSON.parse(await readFile(mapFile,'utf8')).images:[];
  const declared=new Set();
  for(const map of maps){
   assert.match(map.path,/^minimaps\/[a-z0-9-]+\.webp$/);assert.ok(!declared.has(map.path));declared.add(map.path);
   const metadata=await sharp(resolve(root,'prepared',map.path)).metadata();
   assert.equal(metadata.format,'webp');assert.equal(metadata.width,map.width);assert.equal(metadata.height,map.height);
  }
  for(const path of await files(root,{skipPrivateCache:true}))assert.equal(executable.test(path),false,`Object-specific executable remains: ${path}`);
 });
 test(`${id}: every pinned source is declared and byte-verified`,async()=>{
  const {parseSourceManifest,verifySources}=await import('../../tools/objects/dist/operations.js');
  const sourceRoot=resolve(projectRoot,'src/planets',id,'source');const manifest=parseSourceManifest(JSON.parse(await readFile(resolve(sourceRoot,'manifest.json'),'utf8')),id);
  const result=await verifySources({sourceRoot,manifest});assert.ok(result.verifiedCount>0);
 });
 test(`${id}: compiled runtime asset manifest equals the canonical public closure`,async()=>{
  const {parseRuntimeManifest}=await import('../../tools/objects/dist/operations.js');
  const manifest=parseRuntimeManifest(JSON.parse(await readFile(resolve(projectRoot,'src/planets',id,'runtime-assets.json'),'utf8')),id);
  const root=resolve(projectRoot,'public/scenes',id);assert.deepEqual((await readdir(root)).sort(),manifest.assets.map(asset=>asset.filename).sort());
  const {createHash}=await import('node:crypto');for(const asset of manifest.assets){const bytes=await readFile(resolve(root,asset.filename));assert.equal(bytes.length,asset.bytes);assert.equal(createHash('sha256').update(bytes).digest('hex'),asset.sha256);}
 });
}
