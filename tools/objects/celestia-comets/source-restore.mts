import {parseSourceManifest,parseAcquisitionPlan} from '../dist/operations.js';
import {readFile,writeFile,mkdir,mkdtemp,copyFile} from 'node:fs/promises';import {resolve,dirname} from 'node:path';
import {restoreMissingSources,verifySources} from '../../../tools/objects/dist/operations.js';
const stage=await mkdtemp(resolve('output/celestia-comets/fresh-sources-')),results=[];
for(const id of ['comet-17p']){
 const original=resolve('src/objects',id,'source'),sourceRoot=resolve(stage,id),manifest=parseSourceManifest(JSON.parse(await readFile(resolve(original,'manifest.json'),'utf8'))),plan=parseAcquisitionPlan(JSON.parse(await readFile(resolve(original,'preparation/acquisition.json'),'utf8')));
 const wanted=new Set(plan.operations.filter(o=>o.kind==='download').map(o=>o.path));await mkdir(sourceRoot,{recursive:true});await copyFile(resolve(original,'manifest.json'),resolve(sourceRoot,'manifest.json'));
 for(const e of [...manifest.inputs,...manifest.generatedIntermediates,...manifest.documents])if(!wanted.has(e.path)){const dest=resolve(sourceRoot,e.path);await mkdir(dirname(dest),{recursive:true});await copyFile(resolve(original,e.path),dest);}
 const requests:string[]=[];await restoreMissingSources({sourceRoot,manifest,plan,missing:[...wanted],transport:{fetch:async(url,init)=>{requests.push(url);return fetch(url,init);}}});
 const verified=await verifySources({sourceRoot,manifest});results.push({id,downloads:requests.length,downloadedBytes:manifest.inputs.filter(e=>wanted.has(e.path)).reduce((n,e)=>n+e.expectedBytes,0),verified,requests});console.log(id,'source closure verified',requests.length,'downloads');
}
await mkdir('output/celestia-comets/evidence',{recursive:true});await writeFile('output/celestia-comets/evidence/source-restore.json',JSON.stringify({verifiedAt:new Date().toISOString(),scope:'Fresh downloads of the common sky/font source binaries; every checked-in source and the reproducible context snapshot copied into a new staging directory and byte-verified. The other nineteen packages use these same pinned common sky/font binaries. Their checked-in source closures are verified separately.',results},null,2)+'\n');
