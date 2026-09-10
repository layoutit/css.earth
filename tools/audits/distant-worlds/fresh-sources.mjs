import { mkdir as ensureReportDirectory } from 'node:fs/promises';
await ensureReportDirectory('output/distant-worlds', {recursive:true});
import assert from 'node:assert/strict';
import {readFile,writeFile,mkdir,copyFile,stat} from 'node:fs/promises';
import {resolve,dirname} from 'node:path';
import {parseSourceManifest,restoreMissingSources,verifySources,assertSourceFile} from '../../../tools/objects/dist/operations.js';
const {bodies}=JSON.parse(await readFile('tools/objects/source-authoring/distant-worlds/inputs.json'));
const root=resolve('output/distant-worlds/fresh-sources');
assert.equal(await stat(root).then(()=>true,e=>{if(e.code==='ENOENT')return false;throw e;}),false,'Fresh source root must start absent');
const downloaded=new Map(),results=[];
for(const {id} of bodies){
 const original=resolve('src/planets',id,'source'),sourceRoot=resolve(root,id);
 const manifest=parseSourceManifest(JSON.parse(await readFile(resolve(original,'manifest.json'))),id);
 const plan=JSON.parse(await readFile(resolve(original,'preparation/acquisition.json')));
 const entries=[...manifest.inputs,...manifest.generatedIntermediates,...manifest.documents];
 const remote=new Set(plan.operations.filter(op=>op.kind==='download').map(op=>op.path));
 const missing=[],reused=[];
 for(const entry of entries){
  const destination=resolve(sourceRoot,entry.path);
  await mkdir(dirname(destination),{recursive:true});
  if(remote.has(entry.path)&&!downloaded.has(entry.expectedSha256)){missing.push(entry.path);continue;}
  const from=remote.has(entry.path)?downloaded.get(entry.expectedSha256):resolve(original,entry.path);
  await copyFile(from,destination);
  if(remote.has(entry.path))reused.push(entry.path);
 }
 await writeFile(resolve(sourceRoot,'manifest.json'),JSON.stringify(manifest));
 await restoreMissingSources({sourceRoot,manifest,plan,missing});
 const closure=await verifySources({sourceRoot,manifest});
 for(const entry of entries.filter(e=>remote.has(e.path))){await assertSourceFile(entry,resolve(sourceRoot,entry.path));downloaded.set(entry.expectedSha256,resolve(sourceRoot,entry.path));}
 results.push({id,...closure,downloaded:missing,reusedFreshPinnedDownloads:reused});
 console.log('Fresh sources verified',id);
}
await writeFile('output/distant-worlds/fresh-sources.json',JSON.stringify({checkedAt:new Date().toISOString(),scope:'Empty source roots. Checked-in inputs and the reviewed CC BY 4.0 Salacia conference HTML copied; other upstream originals reacquired with the normal pinned acquisition implementation. Identical common originals reuse the first newly downloaded and SHA-256 verified copy.',uniqueDownloadedOriginals:downloaded.size,results},null,2)+'\n');
