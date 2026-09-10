// Restore only the three approved bodies, through the existing hash-checking
// installer, one download at a time. This creates no source or scene assets.
import {readFile, writeFile, mkdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {resolve} from 'node:path';
import {runtimeAssets} from '../../../tools/runtime-assets.mjs';
import {installRuntimeAssets} from '../../../tools/setup.mjs';
const ids=['tethys','iapetus','phoebe'];
const baseline=JSON.parse(await readFile(new URL('./source-review/baseline.json',import.meta.url)));
for(const id of ids){
  const bytes=await readFile(`src/planets/${id}/runtime-assets.json`);
  if(createHash('sha256').update(bytes).digest('hex')!==baseline.bodies[id]['runtime-assets.json'].sha256)
    throw new Error('Restore the frozen baseline before changing the body: '+id);
}
const assets=await runtimeAssets(resolve('.'),ids);
const result=await installRuntimeAssets(assets,{concurrency:1,onProgress:({completed,total})=>{
  if(completed%20===0||completed===total)console.log(`Verified ${completed}/${total} prepared assets`);
}});
await mkdir('output/b9-preparation',{recursive:true});
await writeFile('output/b9-preparation/baseline-install.json',JSON.stringify({ids,...result,
  assets:assets.map(({id,filename,sha256,bytes})=>({id,filename,sha256,bytes}))},null,2)+'\n');
console.log(JSON.stringify(result));
