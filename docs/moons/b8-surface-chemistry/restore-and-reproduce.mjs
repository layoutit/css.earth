// Restore original numeric sources into an empty destination, then reproduce
// the derived maps with checked-in interpretation metadata and pinned recipes.
import assert from 'node:assert/strict';
import {readFile,writeFile,mkdir,mkdtemp,copyFile} from 'node:fs/promises';
import {resolve,dirname} from 'node:path';
import {createHash} from 'node:crypto';
import {spawn} from 'node:child_process';
import {restoreMissingSources,parseSourceManifest} from '../../../tools/objects/dist/operations.js';
const read=async p=>JSON.parse(await readFile(p));
const sha=b=>createHash('sha256').update(b).digest('hex');
const python=process.env.B8_PYTHON??'python3';
await mkdir('output/b8-source-reproduction',{recursive:true});
const directory=await mkdtemp(resolve('output/b8-source-reproduction/run-'));
const report={status:'RUNNING',directory,objects:[]};
const save=()=>writeFile(resolve(directory,'receipt.json'),JSON.stringify(report,null,2)+'\n');
try {
for(const id of ['io','ganymede','enceladus']){
 const current=resolve('src/planets',id,'source'),fresh=resolve(directory,id);
 const manifest=parseSourceManifest(await read(resolve(current,'manifest.json')),id);
 const plan=await read(resolve(current,'preparation/acquisition.json'));
 const selected=plan.operations.filter(step=>step.groups.includes('surface-chemistry'));
 assert.ok(selected.length);assert.ok(selected.every(step=>step.kind==='download'));
 const paths=selected.map(step=>step.path),prefix=id==='enceladus'?'vims-chemistry/':'muse/';
 // These are versioned interpretation/license snapshots, not cached numeric inputs.
 for(const entry of manifest.documents.filter(entry=>entry.path.startsWith(prefix)&&!entry.path.endsWith('.tif'))){
  const bytes=await readFile(resolve(current,entry.path));
  assert.equal(bytes.length,entry.expectedBytes);assert.equal(sha(bytes),entry.expectedSha256);
  const destination=resolve(fresh,entry.path);await mkdir(dirname(destination),{recursive:true});
  await copyFile(resolve(current,entry.path),destination);
 }
 const restored=await restoreMissingSources({sourceRoot:fresh,manifest,plan,missing:paths});
 const recipe=prefix+(id==='enceladus'?'prepare.json':id+'-recipe.json');
 const config=await read(resolve(fresh,recipe));
 const converter='tools/objects/acquisition/'+(id==='enceladus'?'enceladus-vims-spectral.py':'muse-spectral-maps.py');
 await new Promise((accept,reject)=>{
  const child=spawn(python,[converter,resolve(fresh,recipe)],{stdio:'inherit',env:{...process.env,OPENBLAS_NUM_THREADS:'1',OMP_NUM_THREADS:'1'}});
  child.once('error',reject);child.once('exit',code=>code===0?accept():reject(new Error(`${id}: converter exited ${code}`)));
 });
 const outputs=id==='enceladus'?Object.values(config.outputs):config.entries.map(entry=>entry.output);
 const checked=[];
 for(const output of outputs){
  const path=prefix+output,a=await readFile(resolve(fresh,path)),b=await readFile(resolve(current,path));
  assert.ok(a.equals(b),`${id}: fresh scientific map differs: ${path}`);
  checked.push({path,bytes:a.length,sha256:sha(a),byteIdentical:true});
 }
 report.objects.push({id,...restored,restoredFiles:paths.length,outputs:checked});await save();
}
report.status='PASS';
}catch(error){report.status='FAIL';report.error=error.message;throw error;}
finally{await save();console.log(JSON.stringify({status:report.status,directory,objects:report.objects}));}
