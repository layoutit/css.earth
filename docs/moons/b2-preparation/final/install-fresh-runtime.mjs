import assert from 'node:assert/strict';
import {mkdtemp, readFile, writeFile, readdir} from 'node:fs/promises';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {createHash} from 'node:crypto';
const root=process.cwd();
assert.equal(root,'/Users/ekrof/fed/cssEarth-pluto-small-moons');
const ids='moon phobos deimos dimorphos io europa ganymede enceladus tethys dione rhea titan charon'.split(' ');
const {runtimeAssets}=await import(pathToFileURL(resolve(root,'tools/runtime-assets.mts')));
const {installRuntimeAssets}=await import(pathToFileURL(resolve(root,'tools/setup.mts')));
const dest=await mkdtemp('/tmp/moons-b2-fresh-install-');
assert.deepEqual(await readdir(dest),[]);
const assets=(await runtimeAssets(root,ids)).map(a=>({...a,file:resolve(dest,a.id,a.filename)}));
const receipt={startedAt:new Date().toISOString(),scope:'Fresh runtime image installation through the existing installer from published immutable URLs. No local asset reuse; does not by itself prove a fresh checkout build or route.',destination:dest,ids,count:assets.length,bytes:assets.reduce((n,a)=>n+a.bytes,0),status:'RUNNING'};
const save=()=>writeFile(resolve(dest,'receipt.json'),JSON.stringify(receipt,null,2)+'\n');
await save();console.log(dest);
try {
 receipt.result=await installRuntimeAssets(assets,{onProgress:p=>{if(p.completed%100===0)console.log(JSON.stringify(p));}});
 assert.equal(receipt.result.installed,assets.length);assert.equal(receipt.result.reused,0);
 receipt.assets=[];
 for(const a of assets){const bytes=await readFile(a.file);const sha256=createHash('sha256').update(bytes).digest('hex');assert.equal(bytes.length,a.bytes);assert.equal(sha256,a.sha256);receipt.assets.push({id:a.id,filename:a.filename,url:a.url,bytes:a.bytes,sha256});}
 receipt.status='PASS';
} catch(e){receipt.status='FAIL';receipt.error=e.stack;process.exitCode=1;}
receipt.finishedAt=new Date().toISOString();await save();console.log(JSON.stringify({status:receipt.status,result:receipt.result,receipt:resolve(dest,'receipt.json')}));
