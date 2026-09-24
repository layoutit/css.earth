import { parseRuntimeManifest, prepareRuntimeManifest, assembleRuntimeAssets } from './runtime-assets.js';
import { containedPath, parseSourceManifest, verifySources } from './source-files.js';
import { fileURLToPath } from 'node:url';
import { executeAcquisition, parseAcquisitionPlan, restoreMissingSources } from './operations-acquisition.js';
import { RUNTIME_ASSET_ORIGIN, fetchWithRetry, sourceCacheUrl } from '../assets/source-mirror.mts';
import { publishSourceBytes } from '../../src/platform/source-acquisition.mts';
import { readFile, lstat } from 'node:fs/promises';
import { resolve, basename } from 'node:path';

const object=(value:unknown):Record<string,unknown>=>{if(!value||typeof value!=='object'||Array.isArray(value))throw new TypeError('Expected an object.');return value as Record<string,unknown>;};

export async function runOperations(mode:string,id:string,argumentsList:string[]=[]) {
 if(!/^[a-z][a-z0-9-]*$/.test(id))throw new TypeError('Operation needs an object id.');
 const root=process.cwd(),objectRoot=resolve(root,'src/objects',id),sourceRoot=resolve(objectRoot,'source'),preparationRoot=resolve(objectRoot,'prepared');
 const descriptor=object(JSON.parse(await readFile(resolve(objectRoot,'object.json'),'utf8')) as unknown);if(descriptor.id!==id)throw new TypeError('Object descriptor identity differs.');
 if(mode==='acquire'||mode==='verify'){
  const manifest=parseSourceManifest(JSON.parse(await readFile(resolve(sourceRoot,'manifest.json'),'utf8')) as unknown,id);
  const groups=argumentsList.filter(argument=>argument.startsWith('--refresh')).map(argument=>argument.slice(2));
  if(groups.length>1||(groups.length&&argumentsList.includes('--verify-only')))throw new TypeError('Choose one source refresh or verification mode.');
  if(mode==='acquire'&&!argumentsList.includes('--verify-only')){
   const missing:string[]=[];
   for(const entry of [manifest.inputs,manifest.generatedIntermediates,manifest.documents].flat())try{await lstat(containedPath(sourceRoot,entry.path));}catch(error){if((error as NodeJS.ErrnoException).code==='ENOENT')missing.push(entry.path);else throw error;}
   if(groups.length||missing.length){
    const plan=parseAcquisitionPlan(JSON.parse(await readFile(resolve(sourceRoot,'preparation/acquisition.json'),'utf8')) as unknown);
    // The mirror is opt-in in library code (executeAcquisition/restoreMissingSources default to no mirror, so a
    // test's injected transport is never bypassed by surprise); this CLI entry point is the real restore path
    // (invoked by restore-source-inputs.mts), so it explicitly turns the mirror on.
    if(groups.length)await executeAcquisition({sourceRoot,manifest,plan,group:groups[0],mirrorOrigin:RUNTIME_ASSET_ORIGIN});
    else{
     // A generated intermediate is made by the tool its entry names, not downloaded: restore the copy the source mirror
     // keeps, and otherwise say which command makes it, since the body cannot be prepared without it.
     const generated=new Map(manifest.generatedIntermediates.map(entry=>[entry.path,entry.generator] as const)),unmade:string[]=[];
     for(const path of missing.filter(path=>generated.has(path))){
      try{await publishSourceBytes({destination:containedPath(sourceRoot,path),bytes:await fetchWithRetry(fetch,sourceCacheUrl(RUNTIME_ASSET_ORIGIN,id,path))});}
      catch{unmade.push(`${path}: run node ${generated.get(path)}`);}
     }
     await restoreMissingSources({sourceRoot,manifest,plan,missing:missing.filter(path=>!generated.has(path)),mirrorOrigin:RUNTIME_ASSET_ORIGIN});
     if(unmade.length)throw new Error(`${id}: generated sources are missing and not on the source mirror; make them, then publish them with tools/assets/publish-source-cache.mts:\n${unmade.join('\n')}`);
    }
   }
  }
  return verifySources({sourceRoot,manifest});
 }
 const inventoryPath=resolve(objectRoot,'inventory.json');
 if(mode==='manifest'){
  const entries=['runtime.json','content.json','controls.json'];
  const values=await Promise.all(entries.map(async file=>JSON.parse(await readFile(resolve(preparationRoot,file),'utf8')) as unknown));
  return prepareRuntimeManifest({id,publicRoot:resolve(root,'public/scenes',id),objectDirectory:objectRoot,values,allowPreparationArtifacts:true});
 }
 if(mode==='assemble'){
  const productionRoot=resolve(root,'dist/scenes',id);
  // ASSET_ORIGIN builds never populate dist/scenes (astro.config.mts removes the publicDir
  // copy once the build finishes): nothing here needs verifying or pruning.
  if(process.env.ASSET_ORIGIN?.trim()&&!(await lstat(productionRoot).catch(()=>null))?.isDirectory())return parseRuntimeManifest(JSON.parse(await readFile(inventoryPath,'utf8')) as unknown,id);
  return assembleRuntimeAssets({id,inventory:JSON.parse(await readFile(inventoryPath,'utf8')) as unknown,productionRoot});
 }
 throw new TypeError(`Unknown object operation: ${mode}.`);
}
if(process.argv[1] && resolve(process.argv[1])===fileURLToPath(import.meta.url) && basename(process.argv[1])==='operations.js') {
 const [mode,id,...args]=process.argv.slice(2);if(!mode||!id)throw new TypeError('Usage: operations.js <acquire|verify|manifest|assemble> <id>');
 console.log(JSON.stringify(await runOperations(mode,id,args)));
}
