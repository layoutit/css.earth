// Restore the selected B7 originals through the shared acquisition owner into
// a new directory, then independently reproduce the checked-in scientific maps.
import assert from 'node:assert/strict';
import {readFile,writeFile,mkdir,mkdtemp,copyFile} from 'node:fs/promises';
import {resolve,dirname} from 'node:path';
import {createHash} from 'node:crypto';
import {spawn} from 'node:child_process';
import {restoreMissingSources,parseSourceManifest} from '../../../tools/objects/dist/operations.js';
const read=async p=>JSON.parse(await readFile(p));
const sha=b=>createHash('sha256').update(b).digest('hex');
const python=process.env.B7_PYTHON??'python3';
await mkdir('output/b7-source-reproduction',{recursive:true});
const directory=await mkdtemp(resolve('output/b7-source-reproduction/run-'));
const report={status:'RUNNING',directory,objects:[]};
for(const id of ['titan','dione','rhea']){
 const current=resolve('src/planets',id,'source'),fresh=resolve(directory,id);
 const manifest=parseSourceManifest(await read(resolve(current,'manifest.json')),id);
 const plan=await read(resolve(current,'preparation/acquisition.json'));
 const selected=plan.operations.filter(step=>step.groups.includes('cassini-atlas'));
 assert.ok(selected.length);assert.ok(selected.every(step=>step.kind==='download'));
 const paths=selected.map(step=>step.path);
 const restored=await restoreMissingSources({sourceRoot:fresh,manifest,plan,missing:paths});
 const subdir=id==='titan'?'geology':'vims',name=id==='titan'?'prepare-grid.json':'prepare-maps.json';
 const recipe=resolve(fresh,subdir,name);await mkdir(dirname(recipe),{recursive:true});
 await copyFile(resolve(current,subdir,name),recipe);
 const command=['tools/objects/acquisition/'+(id==='titan'?'geology-grid.py':'cassini-vims.py'),recipe];
 await new Promise((accept,reject)=>{
  const child=spawn(python,command,{stdio:'inherit',env:{...process.env,OPENBLAS_NUM_THREADS:'1',OMP_NUM_THREADS:'1'}});
  child.once('error',reject);child.once('exit',code=>code===0?accept():reject(new Error(`${id}: converter exited ${code}`)));
 });
 const outputs=id==='titan'?['geology/titan-geologic-units.tif']:[`vims/${id}-infrared.tif`,`vims/${id}-water-ice.tif`];
 const checked=[];
 for(const path of outputs){
  const a=await readFile(resolve(fresh,path)),b=await readFile(resolve(current,path));
  assert.ok(a.equals(b),`${id}: fresh scientific map differs: ${path}`);
  checked.push({path,bytes:a.length,sha256:sha(a),byteIdentical:true});
 }
 report.objects.push({id,...restored,restoredFiles:paths.length,outputs:checked});
}
report.status='PASS';
await writeFile(resolve(directory,'receipt.json'),JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify(report));
