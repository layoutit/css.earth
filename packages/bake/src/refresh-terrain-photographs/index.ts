/** `@cssearth/bake/refresh-terrain-photographs` (Node only): refresh selected native cylindrical photographic datasets,
 * staged then applied. `packages/bake/cli/refresh-terrain-photographs.mts <object-id> <datasetId>... [--apply-staged]` is
 * its command. The generated solar geometry is written after the packages build, so the host passes it in
 * (`SolarGeometry`). */
import { retainedPhotographicAtlas, parseNativePhotographicSampling, prepareNativePhotographicAtlas } from '../objects/layers/terrestrial/index.ts';
import { sha256 } from '@cssearth/core/node';
import { readFile, writeFile, mkdir, copyFile, stat } from 'node:fs/promises';
import { resolve } from 'node:path';
import sharp from 'sharp';
import type { SolarGeometry } from '../objects/scene/index.ts';
import { requireRecord, requireArray, requireFiniteNumber, requireString } from '@cssearth/core';
const records=(value:unknown)=>requireArray(value).map(value=>requireRecord(value));


const json=async(path:string)=>requireRecord(JSON.parse(await readFile(path,'utf8')));
const save=async(path:string,value:unknown)=>writeFile(path,JSON.stringify(value,null,2)+'\n');
const receiptName='stage-receipt.json';

async function refreshContext(id:string,ids:readonly string[]) {
  if(!/^[a-z][a-z0-9-]*$/.test(id) || !ids.length || new Set(ids).size!==ids.length)throw new TypeError('Choose one body and distinct existing photograph ids.');
  const objectDirectory=resolve('src/objects',id),sourceDirectory=resolve(objectDirectory,'source'),outputDirectory=resolve(objectDirectory,'prepared');
  const stage=resolve('output/terrain-photographs',id),publicDirectory=resolve('site/public/scenes',id);
  const descriptor=await json(resolve(objectDirectory,'object.json')),recipe=await json(resolve(sourceDirectory,'preparation/terrestrial.json'));
  const source=await json(resolve(sourceDirectory,'manifest.json')),sceneBytes=await readFile(resolve(outputDirectory,'scene.json'));
  const scene=requireRecord(JSON.parse(sceneBytes.toString('utf8'))),radial=retainedPhotographicAtlas(scene);
  const raster=requireRecord(recipe.raster),geometry=requireRecord(recipe.geometry),terrain=requireRecord(geometry.radialTerrain);
  if(terrain.sourceLighting || geometry.radialModels || geometry.radialTerrainAlternatives)throw new Error('This refresh requires the existing single-model cylindrical photographic lane.');
  const nativeRecipes=records(raster.observations),surfacesDocument=await json(resolve(outputDirectory,'surfaces.json')),
    surfaces=records(surfacesDocument.surfaces),assetsDocument=await json(resolve(outputDirectory,'assets.json'));
  const inputs=records(source.inputs),selected=ids.map(datasetId=>{
    const observation=nativeRecipes.find(record=>record.id===datasetId),surface=surfaces.find(record=>record.id===datasetId);
    const input=inputs.find(record=>record.datasetId===datasetId && requireArray(record.consumers).includes('surfaces'));
    if(!observation || !surface || !input || observation.textureScale || observation.monochromeBase)throw new Error(`Unsupported photographic selection ${id}/${datasetId}.`);
    return {datasetId,observation,surface,input};
  });
  return {id,ids,objectDirectory,sourceDirectory,outputDirectory,stage,publicDirectory,descriptor,recipe,source,sceneBytes,radial,raster,surfacesDocument,surfaces,assetsDocument,selected};
}

/** Whether any file changed (its contents or its entry) after `time`, or is missing. */
async function anyChangedAfter(paths:readonly string[],time:number) {
  for(const path of paths){const info=await stat(path).catch(()=>null);if(!info || Math.max(info.mtimeMs,info.ctimeMs)>time)return true;}
  return false;
}

/** What a staged receipt was prepared from. It holds while none of these files changed after the receipt was written. */
function bindings(context:Awaited<ReturnType<typeof refreshContext>>) {
  return {files:[resolve(context.outputDirectory,'scene.json'),resolve(context.sourceDirectory,'preparation/terrestrial.json'),
    resolve(context.sourceDirectory,'manifest.json'),resolve(context.objectDirectory,'object.json')],
    inputs:context.selected.map(({datasetId,input})=>({datasetId,path:requireString(input.path)}))};
}

function stableAssets(context:Awaited<ReturnType<typeof refreshContext>>, results:Map<string,Record<string,unknown>>) {
  const groups=requireRecord(context.assetsDocument.surfaces);
  for(const {datasetId} of context.selected) {
    const assets=requireRecord(groups[datasetId]),result=requireRecord(results.get(datasetId)),surface=requireRecord(result.surface),url=requireString(surface.url);
    for(const key of ['url','url2x','polesUrl','polesUrl2x'])if(assets[key]!==url)throw new Error(`Prepared assets have unstable URL ${context.id}/${datasetId}/${key}.`);
  }
}

async function stagedAsset(stage:string,asset:unknown) {
  const record=requireRecord(asset),url=requireString(record.url),filename=url.split('/').at(-1);
  if(!filename || !url.startsWith('/scenes/'))throw new Error('Staged asset URL is invalid.');
  const path=resolve(stage,filename),bytes=await readFile(path).catch((error:unknown)=>{throw new Error(`Missing staged asset: ${path}`,{cause:error});});
  if(bytes.length!==requireFiniteNumber(record.bytes))throw new Error(`Staged asset ${filename} is ${bytes.length} bytes; its record says ${String(record.bytes)}.`);
  const metadata=await sharp(path).metadata();
  if(metadata.width!==requireFiniteNumber(record.width) || metadata.height!==requireFiniteNumber(record.height))throw new Error(`Staged asset dimensions changed: ${filename}`);
  return {filename,bytes:bytes.length};
}

async function saveReceipt(context:Awaited<ReturnType<typeof refreshContext>>, results:Map<string,Record<string,unknown>>, status:'fresh') {
  stableAssets(context,results);
  const entries=[];
  for(const {datasetId} of context.selected) {
    const result=requireRecord(results.get(datasetId)),surface=await stagedAsset(context.stage,result.surface),shadowSurface=await stagedAsset(context.stage,result.shadowSurface);
    entries.push({datasetId,result,surface,shadowSurface});
  }
  const receipt={schema:'cssEarth-native-photograph-stage@2',status,id:context.id,datasetIds:context.ids,inputs:bindings(context).inputs,entries};
  await mkdir(context.stage,{recursive:true});await save(resolve(context.stage,receiptName),receipt);
  return receipt;
}

async function loadReceipt(context:Awaited<ReturnType<typeof refreshContext>>) {
  const receiptPath=resolve(context.stage,receiptName),receipt=await json(receiptPath),current=bindings(context);
  if(receipt.schema!=='cssEarth-native-photograph-stage@2' || receipt.id!==context.id || JSON.stringify(receipt.datasetIds)!==JSON.stringify(context.ids) ||
      JSON.stringify(receipt.inputs)!==JSON.stringify(current.inputs) || await anyChangedAfter(current.files,(await stat(receiptPath)).mtimeMs))
    throw new Error(`${context.id}: staged photographic receipt ${receiptPath} is older than the current scene, recipe, source or descriptor.`);
  const entries=records(receipt.entries),results=new Map<string,Record<string,unknown>>();
  if(entries.length!==context.ids.length)throw new Error('Staged photographic receipt has an unexpected dataset count.');
  for(const entry of entries) {
    const datasetId=requireString(entry.datasetId);if(!context.ids.includes(datasetId) || results.has(datasetId))throw new Error('Staged photographic receipt dataset identity changed.');
    const result=requireRecord(entry.result);await stagedAsset(context.stage,result.surface);await stagedAsset(context.stage,result.shadowSurface);results.set(datasetId,result);
  }
  stableAssets(context,results);return results;
}

export async function refreshTerrainPhotographs(id:string,ids:readonly string[],solarGeometry:SolarGeometry) {
  sharp.concurrency(1);sharp.cache(false);
  const context=await refreshContext(id,ids);await mkdir(context.stage,{recursive:true});
  const sunDirection=solarGeometry.requireBodyFixedSunDirection(id),results=new Map<string,Awaited<ReturnType<typeof prepareNativePhotographicAtlas>>>();
  for(const {datasetId,observation,surface,input} of context.selected) {
    const result=await prepareNativePhotographicAtlas({radial:context.radial,sourceDirectory:context.sourceDirectory,source:input,validity:observation.validity,
      sampling:parseNativePhotographicSampling(observation.nativePhotographicSampling),publicDirectory:context.stage,
      publicBase:`/scenes/${id}/`,id:`${id}-${datasetId}`,sunDirection,mapWidth:requireFiniteNumber(context.raster.width)});
    for(const key of ['surface','shadowSurface'] as const) {
      if(requireRecord(surface[key]).url!==result[key].url)throw new Error('Photographic refresh cannot change resource names.');
    }
    results.set(datasetId,result);
    console.log(JSON.stringify({id,datasetId,...result.nativeSampling,bytes:result.surface.bytes+result.shadowSurface.bytes,decodedRgbaMiB:context.radial.width*context.radial.height*4/1048576,peakRssMiB:process.resourceUsage().maxRSS/1024}));
  }
  await saveReceipt(context,results,'fresh');return results;
}

export async function applyStagedTerrainPhotographs(id:string,ids:readonly string[]) {
  const context=await refreshContext(id,ids),results=await loadReceipt(context);
  const newAssets=new Map<string,{filename:string;bytes:number;sha256:string}>();
  for(const result of results.values())for(const assetValue of [result.surface,result.shadowSurface]) {
    const asset=requireRecord(assetValue),filename=requireString(asset.url).split('/').at(-1)!;
    // The inventory row names the staged file by its R2 content address.
    const bytes=await readFile(resolve(context.stage,filename));
    newAssets.set(filename,{filename,bytes:bytes.length,sha256:sha256(bytes)});
  }
  const inventory=await json(resolve(context.objectDirectory,'inventory.json')),assets=records(inventory.assets);
  if([...newAssets.keys()].some(filename=>!assets.some(asset=>asset.location==='public'&&asset.filename===filename)))throw new Error('Photographic inventory cannot add resources.');
  const documents=new Map<string,Record<string,unknown>>();
  for(const name of ['surfaces.json']) {
    const path=resolve(context.outputDirectory,name),document=await json(path);
    document.surfaces=records(document.surfaces).map(surface=>({...surface,...results.get(requireString(surface.id))}));
    documents.set(path,document);
  }
  // All package and staged inputs were validated above, before any public or package mutation.
  await mkdir(context.publicDirectory,{recursive:true});
  for(const asset of newAssets.values())await copyFile(resolve(context.stage,asset.filename),resolve(context.publicDirectory,asset.filename));
  for(const [path,document] of documents)await save(path,document);
  inventory.assets=assets.map(asset=>asset.location==='public'&&newAssets.has(requireString(asset.filename))?{...asset,...newAssets.get(requireString(asset.filename))}:asset);
  await save(resolve(context.objectDirectory,'inventory.json'),inventory);
  if(!(await readFile(resolve(context.outputDirectory,'scene.json'))).equals(context.sceneBytes))throw new Error('Photographic refresh changed the retained scene.');
  return results;
}
