// The existing publisher and setup protocol, serialized for this three-body batch.
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFile,mkdir,mkdtemp,writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {execFileSync,spawn} from 'node:child_process';
import {runtimeAssets} from '../../../tools/runtime-assets.mjs';
import {installRuntimeAssets} from '../../../tools/setup.mjs';

const root=process.cwd(),ids=['io','ganymede','enceladus'];
const base='2f6f8614add9a5a22ef03b86a47edef631950ade';
const all=await runtimeAssets(root,ids),changed=[];
for(const id of ids){
 const old=JSON.parse(execFileSync('git',['show',`${base}:src/planets/${id}/runtime-assets.json`],{encoding:'utf8'}));
 for(const asset of all.filter(a=>a.id===id)){
  const previous=old.assets.find(a=>a.filename===asset.filename);
  if(previous){assert.equal(asset.sha256,previous.sha256,'Existing asset changed');assert.equal(asset.bytes,previous.bytes);}
  else changed.push(asset);
 }
}
for(const asset of changed){
 const bytes=await readFile(asset.file);assert.equal(bytes.length,asset.bytes);
 assert.equal(createHash('sha256').update(bytes).digest('hex'),asset.sha256);
}
assert.ok(changed.length>0,'No new scientific images to deliver');
const inventorySha256=createHash('sha256').update(JSON.stringify(changed.map(({id,filename,bytes,sha256})=>({id,filename,bytes,sha256})))).digest('hex');
await mkdir('output/b8-delivery',{recursive:true});
const directory=await mkdtemp(resolve('output/b8-delivery/run-'));
await writeFile(resolve(directory,'publication.json'),JSON.stringify(changed,null,2)+'\n');
if(!process.argv.includes('--publish')){
 console.log(JSON.stringify({status:'REVIEW_ONLY',directory,inventorySha256,files:changed.length,bytes:changed.reduce((n,a)=>n+a.bytes,0)}));
 process.exit(0);
}
assert.equal(process.env.B8_PUBLICATION_INVENTORY,inventorySha256,'Publication must match the previously reviewed image inventory');
const missing=[];
for(const asset of changed){
 const response=await fetch(asset.url,{method:'HEAD',signal:AbortSignal.timeout(30000)});
 if(response.status===404)missing.push(asset);
 else assert.equal(response.status,200,`${asset.filename}: unexpected delivery status`);
}
if(missing.length){
 const list=resolve(directory,'upload.json');await writeFile(list,JSON.stringify(missing.map(({key,file})=>({key,file}))));
 await new Promise((accept,reject)=>{
  const child=spawn('npx',['--yes','wrangler@4.129.0','r2','bulk','put','cssearth-assets','--filename',list,
   '--concurrency','1','--remote','--force','--content-type','application/octet-stream',
   '--cache-control','public,max-age=31536000,immutable'],{stdio:'inherit'});
  child.once('error',reject);child.once('close',code=>code===0?accept():reject(new Error(`Publisher exit ${code}`)));
 });
}
// Empty destination, no links or working-asset reuse; setup verifies every byte.
const installation=resolve(directory,'fresh-install');
const receipt=await installRuntimeAssets(all.map(a=>({...a,file:resolve(installation,'public/scenes',a.id,a.filename)})),{concurrency:1});
assert.equal(receipt.reused,0);assert.equal(receipt.installed,all.length);
const result={status:'PASS',base,directory,installation,published:missing.length,newFiles:changed.length,
 newBytes:changed.reduce((n,a)=>n+a.bytes,0),...receipt,assets:all.map(({id,filename,bytes,sha256,url})=>({id,filename,bytes,sha256,url}))};
await writeFile(resolve(directory,'receipt.json'),JSON.stringify(result,null,2)+'\n');
console.log(JSON.stringify({...result,assets:undefined}));
