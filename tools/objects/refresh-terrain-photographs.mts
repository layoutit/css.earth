import { retainedPhotographicAtlas } from './terrestrial-layers/retained-atlas.mts';
import { sha256 } from '../../src/platform/sha256.mts';
import { readFile, writeFile, mkdir, copyFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import sharp from 'sharp';
import { requireBodyFixedSunDirection } from '../../src/platform/solar-geometry.mts';
import { requireRecord, requireArray, requireFiniteNumber, requireString } from '../sources/source-values.mts';
import { parseNativePhotographicSampling, prepareNativePhotographicAtlas } from './terrestrial-layers/native-photograph.mts';
import { prepareObjectProvenance } from './provenance.mts';
const records=(value:unknown)=>requireArray(value).map(value=>requireRecord(value));


const json=async(path:string)=>requireRecord(JSON.parse(await readFile(path,'utf8')));
const save=async(path:string,value:unknown)=>writeFile(path,JSON.stringify(value,null,2)+'\n');
const fingerprint=async(path:string)=>{const bytes=await readFile(path);return {bytes:bytes.length,sha256:sha256(bytes)};};
const receiptName='stage-receipt.json';

async function refreshContext(id:string,ids:readonly string[]) {
  if(!/^[a-z][a-z0-9-]*$/.test(id) || !ids.length || new Set(ids).size!==ids.length)throw new TypeError('Choose one body and distinct existing photograph ids.');
  const objectDirectory=resolve('src/objects',id),sourceDirectory=resolve(objectDirectory,'source'),outputDirectory=resolve(objectDirectory,'prepared');
  const stage=resolve('output/terrain-photographs',id),publicDirectory=resolve('public/scenes',id);
  const descriptor=await json(resolve(objectDirectory,'object.json')),recipe=await json(resolve(sourceDirectory,'preparation/terrestrial.json'));
  const source=await json(resolve(sourceDirectory,'manifest.json')),sceneBytes=await readFile(resolve(outputDirectory,'scene.json'));
  const scene=requireRecord(JSON.parse(sceneBytes.toString('utf8'))),radial=retainedPhotographicAtlas(scene);
  const raster=requireRecord(recipe.raster),geometry=requireRecord(recipe.geometry),terrain=requireRecord(geometry.radialTerrain);
  if(terrain.sourceLighting || geometry.radialModels || geometry.radialTerrainAlternatives)throw new Error('This refresh requires the existing single-model cylindrical photographic lane.');
  const nativeRecipes=records(raster.observations),surfacesDocument=await json(resolve(outputDirectory,'surfaces.json')),
    surfaces=records(surfacesDocument.surfaces),assetsDocument=await json(resolve(outputDirectory,'assets.json'));
  const inputs=records(source.inputs),selected=ids.map(lensId=>{
    const observation=nativeRecipes.find(record=>record.id===lensId),surface=surfaces.find(record=>record.id===lensId);
    const input=inputs.find(record=>record.lensId===lensId && requireArray(record.consumers).includes('surfaces'));
    if(!observation || !surface || !input || observation.textureScale || observation.monochromeBase)throw new Error(`Unsupported photographic selection ${id}/${lensId}.`);
    return {lensId,observation,surface,input};
  });
  return {id,ids,objectDirectory,sourceDirectory,outputDirectory,stage,publicDirectory,descriptor,recipe,source,sceneBytes,radial,raster,surfacesDocument,surfaces,assetsDocument,selected};
}

async function currentBindings(context:Awaited<ReturnType<typeof refreshContext>>) {
  const recipe=await fingerprint(resolve(context.sourceDirectory,'preparation/terrestrial.json'));
  return {scene:{bytes:context.sceneBytes.length,sha256:sha256(context.sceneBytes)},recipe,
    sourceManifest:await fingerprint(resolve(context.sourceDirectory,'manifest.json')),
    descriptor:await fingerprint(resolve(context.objectDirectory,'object.json')),
    inputs:context.selected.map(({lensId,input})=>({lensId,path:requireString(input.path)}))};
}

function stableAssets(context:Awaited<ReturnType<typeof refreshContext>>, results:Map<string,Record<string,unknown>>) {
  const groups=requireRecord(context.assetsDocument.surfaces);
  for(const {lensId} of context.selected) {
    const assets=requireRecord(groups[lensId]),result=requireRecord(results.get(lensId)),surface=requireRecord(result.surface),url=requireString(surface.url);
    for(const key of ['url','url2x','polesUrl','polesUrl2x'])if(assets[key]!==url)throw new Error(`Prepared assets have unstable URL ${context.id}/${lensId}/${key}.`);
  }
}

async function stagedAsset(stage:string,asset:unknown) {
  const record=requireRecord(asset),url=requireString(record.url),filename=url.split('/').at(-1);
  if(!filename || !url.startsWith('/scenes/'))throw new Error('Staged asset URL is invalid.');
  const path=resolve(stage,filename),fileFingerprint=await (async()=>{try{return await fingerprint(path);}catch{throw new Error(`Missing staged asset: ${filename}`);}})();
  if(fileFingerprint.bytes!==requireFiniteNumber(record.bytes) || fileFingerprint.sha256!==requireString(record.sha256))throw new Error(`Staged asset hash mismatch: ${filename}`);
  const metadata=await sharp(path).metadata();
  if(metadata.width!==requireFiniteNumber(record.width) || metadata.height!==requireFiniteNumber(record.height))throw new Error(`Staged asset dimensions changed: ${filename}`);
  return {filename,...fileFingerprint};
}

async function saveReceipt(context:Awaited<ReturnType<typeof refreshContext>>, results:Map<string,Record<string,unknown>>, status:'fresh') {
  stableAssets(context,results);
  const entries=[];
  for(const {lensId} of context.selected) {
    const result=requireRecord(results.get(lensId)),surface=await stagedAsset(context.stage,result.surface),shadowSurface=await stagedAsset(context.stage,result.shadowSurface);
    entries.push({lensId,result,surface,shadowSurface});
  }
  const receipt={schema:'cssEarth-native-photograph-stage@1',status,id:context.id,lensIds:context.ids,bindings:await currentBindings(context),entries};
  await mkdir(context.stage,{recursive:true});await save(resolve(context.stage,receiptName),receipt);
  return receipt;
}

async function loadReceipt(context:Awaited<ReturnType<typeof refreshContext>>) {
  const receipt=await json(resolve(context.stage,receiptName));
  if(receipt.schema!=='cssEarth-native-photograph-stage@1' || receipt.id!==context.id || JSON.stringify(receipt.lensIds)!==JSON.stringify(context.ids) ||
      JSON.stringify(receipt.bindings)!==JSON.stringify(await currentBindings(context)))throw new Error('Staged photographic receipt does not match current scene, recipe, source, or descriptor.');
  const entries=records(receipt.entries),results=new Map<string,Record<string,unknown>>();
  if(entries.length!==context.ids.length)throw new Error('Staged photographic receipt has an unexpected lens count.');
  for(const entry of entries) {
    const lensId=requireString(entry.lensId);if(!context.ids.includes(lensId) || results.has(lensId))throw new Error('Staged photographic receipt lens identity changed.');
    const result=requireRecord(entry.result);await stagedAsset(context.stage,result.surface);await stagedAsset(context.stage,result.shadowSurface);results.set(lensId,result);
  }
  stableAssets(context,results);return results;
}

export async function refreshTerrainPhotographs(id:string,ids:readonly string[]) {
  sharp.concurrency(1);sharp.cache(false);
  const context=await refreshContext(id,ids);await mkdir(context.stage,{recursive:true});
  const sunDirection=requireBodyFixedSunDirection(id),results=new Map<string,Awaited<ReturnType<typeof prepareNativePhotographicAtlas>>>();
  for(const {lensId,observation,surface,input} of context.selected) {
    const result=await prepareNativePhotographicAtlas({radial:context.radial,sourceDirectory:context.sourceDirectory,source:input,validity:observation.validity,
      sampling:parseNativePhotographicSampling(observation.nativePhotographicSampling),publicDirectory:context.stage,
      publicBase:`/scenes/${id}/`,id:`${id}-${lensId}`,sunDirection,mapWidth:requireFiniteNumber(context.raster.width)});
    for(const key of ['surface','shadowSurface'] as const) {
      if(requireRecord(surface[key]).url!==result[key].url)throw new Error('Photographic refresh cannot change resource names.');
    }
    results.set(lensId,result);
    console.log(JSON.stringify({id,lensId,...result.nativeSampling,bytes:result.surface.bytes+result.shadowSurface.bytes,decodedRgbaMiB:context.radial.width*context.radial.height*4/1048576,peakRssMiB:process.resourceUsage().maxRSS/1024}));
  }
  await saveReceipt(context,results,'fresh');return results;
}

export async function applyStagedTerrainPhotographs(id:string,ids:readonly string[]) {
  const context=await refreshContext(id,ids),results=await loadReceipt(context);
  const newAssets=new Map<string,{filename:string;bytes:number;sha256:string}>();
  for(const result of results.values())for(const assetValue of [result.surface,result.shadowSurface]) {
    const asset=requireRecord(assetValue),filename=requireString(asset.url).split('/').at(-1)!;
    newAssets.set(filename,{filename,bytes:requireFiniteNumber(asset.bytes),sha256:requireString(asset.sha256)});
  }
  const inventory=await json(resolve(context.objectDirectory,'inventory.json')),assets=records(inventory.assets);
  if([...newAssets.keys()].some(filename=>!assets.some(asset=>asset.location==='public'&&asset.filename===filename)))throw new Error('Photographic inventory cannot add resources.');
  const documents=new Map<string,Record<string,unknown>>();
  for(const name of ['surfaces.json','material.json']) {
    const path=resolve(context.outputDirectory,name),document=await json(path);
    document.surfaces=records(document.surfaces).map(surface=>({...surface,...results.get(requireString(surface.id))}));
    documents.set(path,document);
  }
  // All package and staged inputs are validated before any public or package mutation.
  for(const asset of newAssets.values()) {
    const current=await fingerprint(resolve(context.stage,asset.filename));
    if(current.bytes!==asset.bytes || current.sha256!==asset.sha256)throw new Error(`Staged asset changed after receipt validation: ${asset.filename}`);
  }
  await mkdir(context.publicDirectory,{recursive:true});
  for(const asset of newAssets.values())await copyFile(resolve(context.stage,asset.filename),resolve(context.publicDirectory,asset.filename));
  for(const [path,document] of documents)await save(path,document);
  inventory.assets=assets.map(asset=>asset.location==='public'&&newAssets.has(requireString(asset.filename))?{...asset,...newAssets.get(requireString(asset.filename))}:asset);
  await save(resolve(context.objectDirectory,'inventory.json'),inventory);
  await prepareObjectProvenance({objectDirectory:context.objectDirectory,publicDirectory:context.publicDirectory,outputDirectory:context.outputDirectory,basis:'recovered'});
  if(sha256(await readFile(resolve(context.outputDirectory,'scene.json')))!==sha256(context.sceneBytes))throw new Error('Photographic refresh changed the retained scene.');
  return results;
}

if(process.argv[1] && import.meta.url===pathToFileURL(resolve(process.argv[1])).href) {
  const [id,...args]=process.argv.slice(2);if(args.includes('--apply-staged'))await applyStagedTerrainPhotographs(id,args.filter(arg=>arg!=='--apply-staged'));
  else await refreshTerrainPhotographs(id,args);
}
