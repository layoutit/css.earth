// Exercise the ordinary CLI from an empty destination with its unmodified
// metadata/import closure. No source inputs, prepared images or symlinks enter it.
import assert from 'node:assert/strict';
import {mkdtemp,mkdir,readFile,writeFile,copyFile,readdir} from 'node:fs/promises';
import {resolve,dirname,relative} from 'node:path';
import {spawn} from 'node:child_process';
import {createHash} from 'node:crypto';
import {runtimeAssets} from '../../../tools/runtime-assets.mjs';
const root=process.cwd(),ids=['asteroid-2001-sn263','sn263-beta','sn263-gamma'];
const out=resolve('output/companion-catalog');
const destination=await mkdtemp(resolve(out,'fresh-install-'));
assert.deepEqual(await readdir(destination),[]);
const copied=new Set();
async function copyClosure(path){
 const source=resolve(root,path);if(copied.has(source))return;copied.add(source);
 const target=resolve(destination,relative(root,source));await mkdir(dirname(target),{recursive:true});await copyFile(source,target);
 if(!source.endsWith('.mjs'))return;
 const code=await readFile(source,'utf8');
 for(const m of code.matchAll(/\bfrom\s+["'](\.[^"']+)["']/g))await copyClosure(resolve(dirname(source),m[1]));
}
await copyClosure('package.json');await copyClosure('tools/setup.mjs');
for(const id of ids)await copyClosure(`src/planets/${id}/runtime-assets.json`);
const receipt={status:'RUNNING',destination,started:new Date().toISOString(),metadataFiles:copied.size,
 command:['pnpm','setup:assets',...ids.map(id=>`--object=${id}`)],assets:[]};
await new Promise((accept,reject)=>{const child=spawn(receipt.command[0],receipt.command.slice(1),{cwd:destination,stdio:'inherit'});child.once('error',reject);child.once('close',code=>code===0?accept():reject(new Error(`Setup exited ${code}`)))});
for(const a of await runtimeAssets(root,ids)){
 const path=resolve(destination,'public/scenes',a.id,a.filename),b=await readFile(path);
 assert.equal(b.length,a.bytes);assert.equal(createHash('sha256').update(b).digest('hex'),a.sha256);
 receipt.assets.push({id:a.id,filename:a.filename,url:a.url,bytes:a.bytes,sha256:a.sha256});
}
receipt.status='PASS';receipt.installed=receipt.assets.length;receipt.reused=0;
receipt.bytes=receipt.assets.reduce((n,a)=>n+a.bytes,0);receipt.finished=new Date().toISOString();
await writeFile(resolve(out,'fresh-install.json'),JSON.stringify(receipt,null,2)+'\n');console.log(JSON.stringify({destination,installed:receipt.installed,bytes:receipt.bytes}));
