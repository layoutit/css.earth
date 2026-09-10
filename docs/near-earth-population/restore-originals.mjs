import assert from 'node:assert/strict';
import {readFile,mkdir,writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {restoreMissingSources} from '../../tools/objects/dist/operations.js';
const inputs=JSON.parse(await readFile('docs/near-earth-population/inputs.json'));
const records=[];
for (const body of inputs) {
 const source=`src/planets/${body.id}/source`,manifest=JSON.parse(await readFile(`${source}/manifest.json`)),plan=JSON.parse(await readFile(`${source}/preparation/acquisition.json`));
 const missing=[`shape/model-${body.modelId}.txt`,...body.papers.map(p=>`reference/${p.file}`)];
 const sourceRoot=resolve('output/near-earth-population/fresh-originals',body.id);
 await mkdir(sourceRoot,{recursive:true});
 for(const path of missing) assert.equal(await readFile(resolve(sourceRoot,path)).then(()=>true,e=>{if(e.code==='ENOENT')return false;throw e}),false,'Destination must start empty');
 const result=await restoreMissingSources({sourceRoot,manifest,plan,missing});
 records.push({id:body.id,...result,paths:missing,scope:'Original mesh and primary-paper bytes restored into an empty destination through the existing acquisition owner, checking the pinned byte count and SHA-256. Shared inherited star/font restoration is unchanged.'});
 console.log(body.id,'original source restoration verified');
}
await writeFile('docs/near-earth-population/source-restoration.json',JSON.stringify(records,null,2)+'\n');
