/** Public asset closure and assembly, independent of source acquisition or CLI dispatch. */
import { containedPath } from './source-files.ts';
import { sha256 } from '../../src/platform/sha256.mts';
import { inventoryPublicAssets, requireInventory } from '../../src/platform/runtime-asset-closure.mts';
import { requireRecord as object } from '../sources/source-values.mts';
import { readFile, readdir, unlink, lstat } from 'node:fs/promises';
import { resolve } from 'node:path';
export interface RuntimeAsset { filename:string;bytes:number;sha256:string; }

/** The public scene textures an object ships: the `public` entries of its inventory. */
export interface RuntimeManifest { assets:RuntimeAsset[]; }

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

/** The renderer's stylesheets, whose `url(/scenes/<id>/…)` values the deploy resolves to published hashes like the
 * prepared data's (site/asset-origin.mts). A body's stylesheet lenses are part of what it ships. */
export async function stylesheetTexts():Promise<string[]> {
 const directory=resolve(process.cwd(),'src/renderers/css/styles');
 // A tree without renderer stylesheets (an isolated fixture) has no stylesheet references.
 const entries=await readdir(directory).catch((error:unknown)=>{if(error instanceof Error&&'code' in error&&error.code==='ENOENT')return [];throw error;});
 const names=entries.filter(name=>name.endsWith('.css')).sort();
 return Promise.all(names.map(name=>readFile(resolve(directory,name),'utf8')));
}

export async function prepareRuntimeManifest({id,publicRoot,objectDirectory,values,allowPreparationArtifacts=false}:{id:string;publicRoot:string;objectDirectory:string;values:unknown[];allowPreparationArtifacts?:boolean}) {
 const urls=collectRuntimeAssetUrls(id,...values,...await stylesheetTexts());if(!urls.length)throw new Error('Prepared object has no runtime asset references.');
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
