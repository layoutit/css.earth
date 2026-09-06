import { fileURLToPath } from 'node:url';
import { executeAcquisition, parseAcquisitionPlan, type AcquisitionPlan, type AcquisitionTransport } from './operations-acquisition.js';
import { isPreparedBlockReference, PREPARED_BLOCK_ENCODING } from '../../src/renderers/css/paging/prepared-block-transport.js';
import type { PreparedReference } from '../../src/renderers/css/paging/types.js';
import { createHash, randomUUID } from 'node:crypto';
import { mkdir, readFile, readdir, rename, rm, writeFile, unlink, lstat } from 'node:fs/promises';
import { dirname, posix, resolve, relative, win32, basename } from 'node:path';
export interface SourceEntry { path:string;expectedBytes:number;expectedSha256:string;id?:string;origin?:string;consumers?:string[]; }
export interface SourceManifest { schema:string;inputs:SourceEntry[];generatedIntermediates:SourceEntry[];documents:SourceEntry[]; }
export interface RuntimeAsset { filename:string;bytes:number;sha256:string; }
export interface RuntimeManifest { schema:string;assets:RuntimeAsset[]; }
const sha256=(bytes:Uint8Array)=>createHash('sha256').update(bytes).digest('hex');
const object=(value:unknown):Record<string,unknown>=>{if(!value||typeof value!=='object'||Array.isArray(value))throw new TypeError('Expected an object.');return value as Record<string,unknown>;};
const nonempty=(value:unknown):value is string=>typeof value==='string'&&value.length>0;
export function containedPath(root:string,path:string):string {
 if(!nonempty(path)||path.includes('\\')||path.includes('\0')||posix.isAbsolute(path)||win32.isAbsolute(path)||posix.normalize(path)!==path||path==='.'||path.startsWith('../'))throw new TypeError(`Unsafe relative path: ${path}.`);
 return resolve(root,path);
}
export function parseSourceManifest(value:unknown,id?:string):SourceManifest {
 const manifest=object(value);
 if(typeof manifest.schema!=='string'||(id!==undefined&&manifest.schema!==`css${id}-authoritative-sources@1`&&manifest.schema!=='cssearth-authoritative-sources@1'))throw new TypeError('Unsupported source manifest schema.');
 const paths=new Set<string>(),ids=new Set<string>();
 for(const collection of ['inputs','generatedIntermediates','documents'] as const){
  const entries=manifest[collection];if(!Array.isArray(entries)||(collection==='inputs'&&!entries.length))throw new TypeError(`Source manifest ${collection} is missing or empty.`);
  for(const value of entries){const entry=object(value);if(typeof entry.path!=='string')throw new TypeError('Source path is missing.');containedPath('.',entry.path);
   if(paths.has(entry.path))throw new TypeError(`Duplicate source path ${entry.path}.`);paths.add(entry.path);
   if(typeof entry.expectedBytes!=='number'||!Number.isSafeInteger(entry.expectedBytes)||entry.expectedBytes<=0||typeof entry.expectedSha256!=='string'||!/^[0-9a-f]{64}$/.test(entry.expectedSha256))throw new TypeError(`Invalid source integrity record: ${entry.path}.`);
   if(collection==='inputs'){
    for(const field of ['id','origin','credit','license','acquisition','redistribution'])if(!nonempty(entry[field]))throw new TypeError(`Source ${entry.path} lacks ${field}.`);
    const inputId=String(entry.id);if(ids.has(inputId))throw new TypeError(`Duplicate source id ${inputId}.`);ids.add(inputId);
    if(!Array.isArray(entry.consumers)||!entry.consumers.length||entry.consumers.some(item=>!nonempty(item))||new Set(entry.consumers).size!==entry.consumers.length)throw new TypeError(`Source ${entry.path} has invalid consumers.`);
    if(entry.licenseEvidence!==undefined&&(!Array.isArray(entry.licenseEvidence)||!entry.licenseEvidence.length||entry.licenseEvidence.some(item=>!nonempty(item))||new Set(entry.licenseEvidence).size!==entry.licenseEvidence.length))throw new TypeError(`Source ${entry.path} has invalid license evidence.`);
   }else if(!nonempty(entry[collection==='documents'?'purpose':'generator']))throw new TypeError(`Source ${entry.path} lacks its provenance purpose.`);
  }
 }
 return manifest as unknown as SourceManifest;
}
export function assertSourceBytes(entry:SourceEntry,bytes:Uint8Array):string {
 if(bytes.byteLength!==entry.expectedBytes)throw new Error(`Source size drifted for ${entry.path}: expected ${entry.expectedBytes}, received ${bytes.byteLength}.`);
 const hash=sha256(bytes);if(hash!==entry.expectedSha256)throw new Error(`Source hash drifted for ${entry.path}: expected ${entry.expectedSha256}, received ${hash}.`);return hash;
}
async function walk(root:string):Promise<string[]>{const files:string[]=[];for(const entry of await readdir(root,{withFileTypes:true})){const path=resolve(root,entry.name);if(entry.isDirectory())files.push(...await walk(path));else if(entry.isFile())files.push(path);else throw new Error(`Unsupported filesystem entry: ${path}.`);}return files;}
export async function verifySources({sourceRoot,manifest,consumer}:{sourceRoot:string;manifest:SourceManifest;consumer?:string}) {
 const collections=[manifest.inputs,manifest.generatedIntermediates,manifest.documents];
 const entries=consumer?manifest.inputs.filter(entry=>entry.consumers?.includes(consumer)):collections.flat();
 if(!entries.length)throw new Error(`No source inputs for ${consumer??'manifest'}.`);
 if(!consumer){const declared=new Set(entries.map(entry=>entry.path)),actual=new Set((await walk(sourceRoot)).map(path=>relative(sourceRoot,path).replaceAll('\\','/')).filter(path=>path!=='manifest.json'));
  const undeclared=[...actual].filter(path=>!declared.has(path)),missing=[...declared].filter(path=>!actual.has(path));
  if(undeclared.length||missing.length)throw new Error(`Source coverage failed. Undeclared: ${undeclared.join(', ')||'none'}. Missing: ${missing.join(', ')||'none'}.`);
 }
 for(const entry of entries)assertSourceBytes(entry,await readFile(containedPath(sourceRoot,entry.path)));
 return {inputCount:manifest.inputs.length,generatedIntermediateCount:manifest.generatedIntermediates.length,documentCount:manifest.documents.length,verifiedCount:entries.length};
}
export async function publishPinnedSource({sourceRoot,entry,bytes}:{sourceRoot:string;entry:SourceEntry;bytes:Uint8Array}) {
 assertSourceBytes(entry,bytes);const path=containedPath(sourceRoot,entry.path);await mkdir(dirname(path),{recursive:true});
 const temporary=`${path}.partial-${process.pid}-${randomUUID()}`;
 try{await writeFile(temporary,bytes,{flag:'wx'});await rename(temporary,path);}finally{await rm(temporary,{force:true});}
 return entry;
}
export async function acquirePinnedDownloads({sourceRoot,manifest,paths,fetchBytes}:{sourceRoot:string;manifest:SourceManifest;paths:readonly string[];fetchBytes?:(url:string)=>Promise<Uint8Array>}) {
 const download=fetchBytes??(async(url:string)=>{const response=await fetch(url);if(!response.ok)throw new Error(`Acquisition failed ${response.status}: ${url}.`);return new Uint8Array(await response.arrayBuffer());});
 const entries=[...manifest.inputs,...manifest.documents];
 for(const path of paths){const entry=entries.find(entry=>entry.path===path);if(!entry||!entry.origin||!/^https?:\/\//.test(entry.origin))throw new TypeError(`No declared direct acquisition URL for ${path}.`);
  await publishPinnedSource({sourceRoot,entry,bytes:await download(entry.origin)});
 }
 return {acquiredCount:paths.length};
}
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
   // Range-addressed geometry is delivered by the pinned paging release, not
   // the flat image directory. Its integrity is carried in the reference and
   // verified by both source preparation and the runtime transport.
   if((value as Record<string,unknown>).encoding===PREPARED_BLOCK_ENCODING){
    if(!isPreparedBlockReference(value as PreparedReference,prefix))throw new TypeError('Invalid prepared geometry reference.');
    return;
   }
   Object.values(value).forEach(visit);
  }
 };values.forEach(visit);return [...urls].sort();
}
export function parseRuntimeManifest(value:unknown,id:string):RuntimeManifest {
 const manifest=object(value);if(manifest.schema!==`css${id}-runtime-assets@1`||!Array.isArray(manifest.assets)||!manifest.assets.length)throw new TypeError('Runtime manifest is invalid.');
 const files=new Set<string>();for(const value of manifest.assets){const entry=object(value);if(typeof entry.filename!=='string'||!/^[a-z0-9][a-z0-9@._-]*$/.test(entry.filename)||files.has(entry.filename)||typeof entry.bytes!=='number'||!Number.isSafeInteger(entry.bytes)||entry.bytes<=0||typeof entry.sha256!=='string'||!/^[0-9a-f]{64}$/.test(entry.sha256))throw new TypeError('Runtime manifest asset is invalid.');files.add(entry.filename);}
 return manifest as unknown as RuntimeManifest;
}
async function verifyAssetFiles(root:string,manifest:RuntimeManifest,exact:boolean) {
 const expected=new Set(manifest.assets.map(asset=>asset.filename));
 if(exact){const actual=await readdir(root,{withFileTypes:true});if(actual.some(entry=>!entry.isFile()||!expected.has(entry.name))||actual.length!==expected.size){const actualNames=new Set(actual.map(entry=>entry.name));throw new Error(`Runtime directory closure differs. Missing: ${[...expected].filter(file=>!actualNames.has(file)).join(', ')||'none'}. Undeclared: ${actual.filter(entry=>!entry.isFile()||!expected.has(entry.name)).map(entry=>entry.name).join(', ')||'none'}.`);}}
 for(const asset of manifest.assets){const path=containedPath(root,asset.filename);if(!(await lstat(path)).isFile())throw new Error(`Runtime asset is not a regular file: ${asset.filename}.`);const bytes=await readFile(path);if(bytes.length!==asset.bytes||sha256(bytes)!==asset.sha256)throw new Error(`Runtime asset drifted: ${asset.filename}.`);}
}
export async function prepareRuntimeManifest({id,publicRoot,manifestPath,values,allowPreparationArtifacts=false}:{id:string;publicRoot:string;manifestPath:string;values:unknown[];allowPreparationArtifacts?:boolean}) {
 const urls=collectRuntimeAssetUrls(id,...values);if(!urls.length)throw new Error('Prepared object has no runtime asset references.');
 const assets:RuntimeAsset[]=[];
 for(const url of urls){const filename=basename(url),bytes=await readFile(containedPath(publicRoot,filename));assets.push({filename,bytes:bytes.length,sha256:sha256(bytes)});}
 const manifest={schema:`css${id}-runtime-assets@1`,assets};await verifyAssetFiles(publicRoot,manifest,!allowPreparationArtifacts);
 await mkdir(dirname(manifestPath),{recursive:true});const temporary=`${manifestPath}.partial-${process.pid}-${randomUUID()}`;
 try{await writeFile(temporary,JSON.stringify(manifest,null,2)+'\n',{flag:'wx'});await rename(temporary,manifestPath);}finally{await rm(temporary,{force:true});}
 return manifest;
}
export async function assembleRuntimeAssets({id,manifest,productionRoot}:{id:string;manifest:RuntimeManifest;productionRoot:string}) {
 parseRuntimeManifest(manifest,id);
 // Verify required assets before deleting build leftovers: a failed assembly retains its evidence.
 await verifyAssetFiles(productionRoot,manifest,false);
 const expected=new Set(manifest.assets.map(asset=>asset.filename)),entries=await readdir(productionRoot,{withFileTypes:true});
 if(entries.some(entry=>!entry.isFile()))throw new Error('Production asset directory contains a non-file entry.');
 for(const entry of entries)if(!expected.has(entry.name))await unlink(resolve(productionRoot,entry.name));
 await verifyAssetFiles(productionRoot,manifest,true);return manifest;
}

export async function runOperations(mode:string,id:string,argumentsList:string[]=[]) {
 if(!/^[a-z][a-z0-9-]*$/.test(id))throw new TypeError('Operation needs an object id.');
 const root=process.cwd(),objectRoot=resolve(root,'src/planets',id),sourceRoot=resolve(objectRoot,'source'),preparationRoot=resolve(objectRoot,'prepared');
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
    if(groups.length)await executeAcquisition({sourceRoot,manifest,plan,group:groups[0]});
    else await restoreMissingSources({sourceRoot,manifest,plan,missing});
   }
  }
  return verifySources({sourceRoot,manifest});
 }
 const manifestPath=resolve(objectRoot,'runtime-assets.json');
 if(mode==='manifest'){
  const entries=(await readdir(preparationRoot)).filter(file=>file.endsWith('.json')&&file!=='runtime-assets.json'&&file!=='object.json');
  const values=await Promise.all(entries.map(async file=>JSON.parse(await readFile(resolve(preparationRoot,file),'utf8')) as unknown));
  return prepareRuntimeManifest({id,publicRoot:resolve(root,'public/scenes',id),manifestPath,values});
 }
 if(mode==='assemble')return assembleRuntimeAssets({id,manifest:parseRuntimeManifest(JSON.parse(await readFile(manifestPath,'utf8')) as unknown,id),productionRoot:resolve(root,'dist/scenes',id)});
 throw new TypeError(`Unknown object operation: ${mode}.`);
}
/** Default acquisition restores missing pins only; changed existing bytes fail verification. */
export async function restoreMissingSources({sourceRoot,manifest,plan,missing,transport}:{sourceRoot:string;manifest:SourceManifest;plan:AcquisitionPlan;missing:string[];transport?:AcquisitionTransport}) {
 const wanted=new Set(missing);
 const operations=plan.operations.filter(step=>'path' in step&&wanted.has(step.path));
 const covered=new Set(operations.map(step=>'path' in step?step.path:''));
 if([...wanted].some(path=>!covered.has(path)))throw new Error(`No authored acquisition restores: ${[...wanted].filter(path=>!covered.has(path)).join(', ')}.`);
 if(!operations.length)return {operationCount:0};
 return executeAcquisition({sourceRoot,manifest,plan:{...plan,operations:operations.map(step=>({...step,groups:['restore-missing']}))},group:'restore-missing',transport});
}
if(process.argv[1] && resolve(process.argv[1])===fileURLToPath(import.meta.url) && basename(process.argv[1])==='operations.js') {
 const [mode,id,...args]=process.argv.slice(2);if(!mode||!id)throw new TypeError('Usage: operations.js <acquire|verify|manifest|assemble> <id>');
 console.log(JSON.stringify(await runOperations(mode,id,args)));
}
