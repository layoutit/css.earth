import { containedPath, parseSourceManifest, verifySources, type SourceManifest } from './source-files.js';
import { sha256 } from '../../src/platform/sha256.mts';
import { inventoryPublicAssets, requireInventory } from '../../src/platform/runtime-asset-closure.mts';
import { fileURLToPath } from 'node:url';
import { executeAcquisition, parseAcquisitionPlan, type AcquisitionPlan, type AcquisitionTransport } from './operations-acquisition.js';
import { RUNTIME_ASSET_ORIGIN } from '../assets/source-mirror.mts';
import { readFile, readdir, unlink, lstat } from 'node:fs/promises';
import { resolve, basename } from 'node:path';
export interface RuntimeAsset { filename:string;bytes:number;sha256:string; }
/** The public scene textures an object ships: the `public` entries of its inventory. */
export interface RuntimeManifest { assets:RuntimeAsset[]; }

const object=(value:unknown):Record<string,unknown>=>{if(!value||typeof value!=='object'||Array.isArray(value))throw new TypeError('Expected an object.');return value as Record<string,unknown>;};
const nonempty=(value:unknown):value is string=>typeof value==='string'&&value.length>0;
/** Finds actual image references in prepared data and authored content, including CSS URL values. */
export function collectRuntimeAssetUrls(id:string,...values:unknown[]):string[] {
 if(!/^[a-z][a-z0-9-]*$/.test(id))throw new TypeError('Invalid object id.');
 const prefix=`/scenes/${id}/`,urls=new Set<string>();
 const add=(url:string)=>{if(!url.startsWith(prefix))return;const file=url.slice(prefix.length);if(!/^[a-z0-9][a-z0-9@._-]*$/.test(file))throw new TypeError(`Unsafe runtime asset URL: ${url}.`);urls.add(url);};
 const visit=(value:unknown):void=>{
  if(typeof value==='string'){
   if(value!==prefix&&value.startsWith(prefix)&&!/[\s;()"']/.test(value))add(value);
   for(const match of value.matchAll(/url\(\s*["']?(\/scenes\/[^\s)"']+)["']?\s*\)/g))add(match[1]);
  }else if(Array.isArray(value))value.forEach(visit);else if(value&&typeof value==='object'){
   Object.values(value).forEach(visit);
  }
 };values.forEach(visit);return [...urls].sort();
}
export function parseRuntimeManifest(value:unknown,id:string):RuntimeManifest {
 const inventory=requireInventory(id,value),manifest={assets:inventory.assets.filter(asset=>asset.location==='public').map(({filename,bytes,sha256})=>({filename,bytes,sha256}))};
 if(!manifest.assets.length)throw new TypeError('Runtime manifest is invalid.');
 const files=new Set<string>();for(const value of manifest.assets){const entry=object(value);if(typeof entry.filename!=='string'||!/^[a-z0-9][a-z0-9@._-]*$/.test(entry.filename)||files.has(entry.filename)||typeof entry.bytes!=='number'||!Number.isSafeInteger(entry.bytes)||entry.bytes<=0||typeof entry.sha256!=='string'||!/^[0-9a-f]{64}$/.test(entry.sha256))throw new TypeError('Runtime manifest asset is invalid.');files.add(entry.filename);}
 return manifest as unknown as RuntimeManifest;
}
async function verifyAssetFiles(root:string,manifest:RuntimeManifest,exact:boolean) {
 const expected=new Set(manifest.assets.map(asset=>asset.filename));
 if(exact){const actual=await readdir(root,{withFileTypes:true});if(actual.some(entry=>!entry.isFile()||!expected.has(entry.name))||actual.length!==expected.size){const actualNames=new Set(actual.map(entry=>entry.name));throw new Error(`Runtime directory closure differs. Missing: ${[...expected].filter(file=>!actualNames.has(file)).join(', ')||'none'}. Undeclared: ${actual.filter(entry=>!entry.isFile()||!expected.has(entry.name)).map(entry=>entry.name).join(', ')||'none'}.`);}}
 for(const asset of manifest.assets){const path=containedPath(root,asset.filename);if(!(await lstat(path)).isFile())throw new Error(`Runtime asset is not a regular file: ${asset.filename}.`);const bytes=await readFile(path);if(bytes.length!==asset.bytes||sha256(bytes)!==asset.sha256)throw new Error(`Runtime asset drifted: ${asset.filename}.`);}
}
export async function prepareRuntimeManifest({id,publicRoot,objectDirectory,values,allowPreparationArtifacts=false}:{id:string;publicRoot:string;objectDirectory:string;values:unknown[];allowPreparationArtifacts?:boolean}) {
 const urls=collectRuntimeAssetUrls(id,...values);if(!urls.length)throw new Error('Prepared object has no runtime asset references.');
 const inventory=await inventoryPublicAssets({objectId:id,objectDirectory,urls,publicRoot,allowPreparationArtifacts});
 const manifest={assets:(inventory?.assets??[]).filter(asset=>asset.location==='public').map(({filename,bytes,sha256})=>({filename,bytes,sha256}))};
 await verifyAssetFiles(publicRoot,manifest,!allowPreparationArtifacts);
 return manifest;
}
export async function assembleRuntimeAssets({id,inventory,productionRoot}:{id:string;inventory:unknown;productionRoot:string}) {
 const manifest=parseRuntimeManifest(inventory,id);
 // Verify required assets before deleting build leftovers: a failed assembly retains its evidence.
 await verifyAssetFiles(productionRoot,manifest,false);
 const expected=new Set(manifest.assets.map(asset=>asset.filename)),entries=await readdir(productionRoot,{withFileTypes:true});
 if(entries.some(entry=>!entry.isFile()))throw new Error('Production asset directory contains a non-file entry.');
 for(const entry of entries)if(!expected.has(entry.name))await unlink(resolve(productionRoot,entry.name));
 await verifyAssetFiles(productionRoot,manifest,true);return manifest;
}

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
    else await restoreMissingSources({sourceRoot,manifest,plan,missing,mirrorOrigin:RUNTIME_ASSET_ORIGIN});
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
/** Default acquisition restores missing pins only. Existing bytes are verified afterwards, so a stale pin never blocks a download. */
export async function restoreMissingSources({sourceRoot,manifest,plan,missing,transport,mirrorOrigin}:{sourceRoot:string;manifest:SourceManifest;plan:AcquisitionPlan;missing:string[];transport?:AcquisitionTransport;mirrorOrigin?:string|null}) {
 const wanted=new Set(missing);
 const operations=plan.operations.filter(step=>'path' in step&&wanted.has(step.path));
 const covered=new Set(operations.map(step=>'path' in step?step.path:''));
 if([...wanted].some(path=>!covered.has(path)))throw new Error(`No authored acquisition restores: ${[...wanted].filter(path=>!covered.has(path)).join(', ')}.`);
 if(!operations.length)return {operationCount:0};
 return executeAcquisition({sourceRoot,manifest,plan:{...plan,operations:operations.map(step=>({...step,groups:['restore-missing']}))},group:'restore-missing',transport,mirrorOrigin});
}
if(process.argv[1] && resolve(process.argv[1])===fileURLToPath(import.meta.url) && basename(process.argv[1])==='operations.js') {
 const [mode,id,...args]=process.argv.slice(2);if(!mode||!id)throw new TypeError('Usage: operations.js <acquire|verify|manifest|assemble> <id>');
 console.log(JSON.stringify(await runOperations(mode,id,args)));
}
