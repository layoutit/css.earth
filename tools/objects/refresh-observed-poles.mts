import { createHash } from 'node:crypto';
import { createReadStream } from 'node:fs';
import { mkdir, readFile, rm, stat, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import sharp from 'sharp';
import { parseAuthoredObjectDescriptor } from '@cssearth/objects';
import { prepareObservedSurfaces, parseObservedSurfaceRecipe } from './giant-layers/observations.mts';

const hash=(bytes: Uint8Array)=>createHash('sha256').update(bytes).digest('hex');

async function verifySource(sourceDirectory: string, id: string, path: string, expectedBytes: number, expectedSha256: string): Promise<[string,string]> {
  const filename=resolve(sourceDirectory,path),details=await stat(filename),digest=createHash('sha256');
  if(details.size!==expectedBytes)throw new Error(`Observed source byte length differs: ${path}`);
  for await(const chunk of createReadStream(filename))digest.update(chunk);
  const sha256=digest.digest('hex');
  if(sha256!==expectedSha256)throw new Error(`Observed source digest differs: ${path}`);
  return [`src/planets/${id}/source/${path}`,sha256];
}

/** Stage selected observed pole atlases without rebuilding the body or any surface product. */
export async function refreshObservedPoles(id: string, lensIds: readonly string[]) {
  if(!/^[a-z][a-z0-9-]*$/u.test(id)||!lensIds.length||new Set(lensIds).size!==lensIds.length)throw new TypeError('Choose one body and distinct observed lens ids.');
  sharp.cache(false);sharp.concurrency(1);
  const objectDirectory=resolve('src/planets',id),sourceDirectory=resolve(objectDirectory,'source'),recipePath=resolve(sourceDirectory,'preparation/observations.json'),manifestPath=resolve(sourceDirectory,'manifest.json');
  const scenePath=`src/planets/${id}/prepared/scene.refs.json`,sceneBytes=await readFile(scenePath);
  const [descriptorBytes,recipeBytes,manifestBytes]=await Promise.all([readFile(resolve(objectDirectory,'object.json')),readFile(recipePath),readFile(manifestPath)]);
  const descriptor=parseAuthoredObjectDescriptor(JSON.parse(descriptorBytes.toString('utf8'))),recipeSource=descriptor.recipe.sources.find(source=>source.id==='observations');
  if(descriptor.id!==id||!recipeSource||recipeSource.path!=='source/preparation/observations.json'||recipeSource.sha256!==hash(recipeBytes))throw new Error('Observed pole refresh requires the current descriptor recipe pin.');
  const config=parseObservedSurfaceRecipe(JSON.parse(recipeBytes.toString('utf8'))),lenses=config.lenses.filter(lens=>lensIds.includes(lens.id));
  if(lenses.length!==lensIds.length)throw new Error('Observed pole refresh requested an unknown lens.');
  const sourcePaths=new Set(lenses.flatMap(lens=>[lens.source,...(lens.calibration?[lens.calibration.source]:[])])),pins=config.sources.filter(source=>sourcePaths.has(source.path));
  if(pins.length!==sourcePaths.size)throw new Error('Observed pole refresh has an unpinned input.');
  const sourceInputs=Object.fromEntries(await Promise.all(pins.map(pin=>verifySource(sourceDirectory,id,pin.path,pin.expectedBytes,pin.expectedSha256))));
  const stage=resolve('output/observed-poles',id,[...lensIds].sort().join('--'));
  await rm(stage,{recursive:true,force:true});await mkdir(stage,{recursive:true});
  const result=await prepareObservedSurfaces({sourceDirectory,publicDirectory:stage,config,lensIds,productKinds:['poles'],write:true});
  const assets=result.assets.map(asset=>({filename:asset.filename,url:`/scenes/${id}/${asset.filename}`,width:asset.width,height:asset.height,bytes:asset.bytes,sha256:asset.sha256}));
  if(assets.length!==lensIds.length||new Set(assets.map(asset=>asset.filename)).size!==assets.length)throw new Error('Observed pole refresh produced an unexpected asset set.');
  const receipt={id,inputs:{[scenePath]:hash(sceneBytes),[`src/planets/${id}/source/preparation/observations.json`]:hash(recipeBytes),[`src/planets/${id}/source/manifest.json`]:hash(manifestBytes),...sourceInputs},assets};
  await writeFile(resolve(stage,'receipt.json'),`${JSON.stringify(receipt,null,2)}\n`);
  return receipt;
}

if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href) {
  const [id,...lensIds]=process.argv.slice(2);await refreshObservedPoles(id??'',lensIds);
}
