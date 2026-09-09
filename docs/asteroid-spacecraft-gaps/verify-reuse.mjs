import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {readFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
const boundedGit=['-c','core.packedGitLimit=64m','-c','core.packedGitWindowSize=4m'];
const base='a5a34bdefa849801d092f10755cf81f6f3f23f5e';
const paths=execFileSync('git',[...boundedGit,'status','--porcelain','--untracked-files=no'],{encoding:'utf8'}).trimEnd().split('\n').map(p=>p.slice(3)).filter(p=>p.startsWith('src/planets/')&&p.endsWith('/prepared/runtime.json'));
// Hash the unchanged serialized prefix and suffix. Inspect only the small
// navigation object's delimiters, without materializing huge scene trees.
function withoutMarkers(bytes){
 const key=Buffer.from('"heliocentricView":'),start=bytes.indexOf(key);
 assert.ok(start>=0);assert.equal(bytes.indexOf(key,start+key.length),-1);
 let pos=start+key.length,depth=0,string=false,escape=false,end;
 assert.equal(bytes[pos],123);
 for(;pos<bytes.length;pos++){
  const c=bytes[pos];
  if(string){if(escape)escape=false;else if(c===92)escape=true;else if(c===34)string=false;continue;}
  if(c===34){string=true;continue;}
  if(c===123||c===91)depth++;
  if(c===125||c===93){depth--;if(depth===0){end=pos+1;break;}}
 }
 assert.ok(end);
 return createHash('sha256').update(bytes.subarray(0,start)).update(bytes.subarray(end)).digest('hex');
}
const records=[];
for(const path of paths){
 const before=execFileSync('git',[...boundedGit,'show',`${base}:${path}`],{maxBuffer:384*1024*1024});
 const after=await readFile(path);
 const hash=withoutMarkers(before);assert.equal(withoutMarkers(after),hash,path);
 records.push({id:path.split('/')[2],unchangedOutsideMarkersSha256:hash});
}
await writeFile('docs/asteroid-spacecraft-gaps/integration-reuse.json',JSON.stringify({base,changedExistingRuntimes:records.length,verification:'Exact serialized bytes outside heliocentricView match merged main.',records},null,2)+'\n');
console.log('Verified existing runtimes unchanged outside navigation markers:',records.length);
