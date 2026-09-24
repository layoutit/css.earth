/** Stage one selected raster lane without rebuilding the object's bands, lighting, geometry, or scene.
 * `node tools/objects/dist/refresh-sphere-photographs.js <body-id> <lens-id>` writes only that lens below
 * output/sphere-photographs/<body-id>/<lens-id>. The caller decides whether and how to apply the receipt. */
import { sha256 } from '../../src/platform/sha256.mts';
import { createHash } from 'node:crypto';
import { createReadStream } from 'node:fs';
import { access, mkdir, readFile, writeFile } from 'node:fs/promises';
import { basename, resolve, relative } from 'node:path';
import sharp from 'sharp';
import type { Sharp } from 'sharp';
import { completeEnhancedCoverage, createNativePhotographPolarSprite, packLatitudeRaster } from '@cssearth/objects';
import { missingCoverageColor } from '../../src/platform/prepare-missing-coverage.mts';
import { applyNativeSurfaceExposure, loadNativeSourcePoleSampler } from '../../src/preparation/raster/surfaces.js';
import { loadNativeObservationPoleSampler, parseObservationLens } from './observation/raster.mts';
import { loadNativePhotograph } from './terrestrial-layers/native-photograph-source.mts';
import { parseSolidObservation } from './terrestrial-layers/solid-source.mts';
import { requireArray, requireFiniteNumber, requireRecord, requireString } from '@cssearth/core';

type RecordValue = Record<string, unknown>;
type Fingerprint = {bytes:number; sha256:string};
type NativeSampler = {sample(longitudeDegrees:number, latitudeDegrees:number, color:number[]):boolean};
type Surface = {id:string; source:string; output:string; nativeSourcePoles?:boolean; science?:RecordValue; coverage?:{normal:string;topography:string;references:string[]}; exposure?:number[]; encoding?:RecordValue};
type Recipe = {sourceWidth:number;sourceHeight:number;width:number;height:number;latitudeBands:number;polarTile:number;densities:number[];resample:string;unpackedResizeBeforePack?:boolean;polesCombined:boolean;polesOutput:string;publicBase:string;surfaces:Surface[]};


const outputName = (template:string, density=1, id='') => template.replaceAll('{density}',String(density)).replaceAll('{suffix}',density===1?'':'@2x').replaceAll('{id}',id);
const repositoryPath = (path:string) => relative(process.cwd(),path).replaceAll('\\','/');
const json = async (path:string) => requireRecord(JSON.parse(await readFile(path,'utf8')));

async function fingerprint(path:string):Promise<Fingerprint> {
  const digest=createHash('sha256'); let bytes=0;
  for await(const chunk of createReadStream(path)) { digest.update(chunk); bytes+=chunk.length; }
  return {bytes,sha256:digest.digest('hex')};
}
async function existingMetadata(path:string) {
  try { await access(path); return await sharp(path).metadata(); }
  catch (error) { if (error instanceof Error && 'code' in error && error.code==='ENOENT') return null; throw error; }
}
function contained(root:string, path:string) { const candidate=resolve(root,path); if (!candidate.startsWith(root+'/')) throw new TypeError(`Path escapes its source directory: ${path}`); return candidate; }
function sourceRecord(manifest:RecordValue, path:string) {
  const entries=requireArray(manifest.inputs).map(value=>requireRecord(value));
  const selected=entries.filter(value=>value.path===path);
  if(selected.length!==1) throw new Error(`Expected one declared source input for ${path}.`);
  return selected[0]!;
}
async function verifySourcePin(sourceDirectory:string, source:RecordValue) {
  const path=contained(sourceDirectory,requireString(source.path)), actual=await fingerprint(path);
  return {path,actual};
}
function recipe(value:RecordValue):Recipe {
  const sourceWidth=requireFiniteNumber(value.sourceWidth),sourceHeight=requireFiniteNumber(value.sourceHeight),width=requireFiniteNumber(value.width),height=requireFiniteNumber(value.height),
    latitudeBands=requireFiniteNumber(value.latitudeBands),polarTile=requireFiniteNumber(value.polarTile),resample=requireString(value.resample),polesOutput=requireString(value.polesOutput),publicBase=requireString(value.publicBase);
  const densities=requireArray(value.densities).map(value=>requireFiniteNumber(value)),surfaces=requireArray(value.surfaces).map(value=>{
    const entry=requireRecord(value), coverage=entry.coverage===undefined?undefined:requireRecord(entry.coverage), science=entry.science===undefined?undefined:requireRecord(entry.science);
    return {id:requireString(entry.id),source:requireString(entry.source),output:requireString(entry.output),nativeSourcePoles:entry.nativeSourcePoles===true,
      science,exposure:entry.exposure===undefined?undefined:requireArray(entry.exposure).map(value=>requireFiniteNumber(value)),encoding:entry.encoding===undefined?undefined:requireRecord(entry.encoding),
      coverage:coverage?{normal:requireString(coverage.normal),topography:requireString(coverage.topography),references:requireArray(coverage.references).map(value=>requireString(value))}:undefined};
  });
  if(![sourceWidth,sourceHeight,width,height,latitudeBands,polarTile,...densities].every(value=>Number.isSafeInteger(value)&&value>0)||JSON.stringify(densities)!=='[1,2]') throw new TypeError('Unsupported raster dimensions.');
  if(resample!=='source-packed'&&resample!=='density-before-pack') throw new TypeError('Unsupported raster storage.');
  if(typeof value.polesCombined!=='boolean'||typeof value.unpackedResizeBeforePack!=='undefined'&&value.unpackedResizeBeforePack!==true) throw new TypeError('Invalid raster pole flags.');
  return {sourceWidth,sourceHeight,width,height,latitudeBands,polarTile,densities,resample,unpackedResizeBeforePack:value.unpackedResizeBeforePack===true,polesCombined:value.polesCombined,polesOutput,publicBase,surfaces};
}
async function readSourceRgba(path:string,width:number,height:number) {
  const decoded=await sharp(path,{limitInputPixels:false}).ensureAlpha().raw().toBuffer({resolveWithObject:true});
  if(decoded.info.width!==width||decoded.info.height!==height||decoded.info.channels!==4) throw new Error(`Source dimensions changed: ${path}`);
  return new Uint8Array(decoded.data);
}
function encodeBand(image:Sharp, encoding:RecordValue|undefined, density:number) {
  if(!encoding) return image.webp({quality:density===1?88:90,smartSubsample:true});
  const format=requireString(encoding.format), encoder=requireString(encoding.encoder), quality=requireFiniteNumber(encoding.quality), progressive=encoding.progressive;
  if(format!=='jpeg'||(encoder!=='libjpeg'&&encoder!=='mozjpeg')||typeof progressive!=='boolean') throw new TypeError('Unsupported selected band encoding.');
  const pixels=image.removeAlpha();
  const grayscale=encoding.grayscale===true, chroma=encoding.chromaSubsampling;
  if(chroma!==undefined&&chroma!=='4:2:0'&&chroma!=='4:4:4') throw new TypeError('Unsupported selected band chroma sampling.');
  return (grayscale?pixels.grayscale().toColourspace('b-w'):pixels).jpeg({quality,mozjpeg:encoder==='mozjpeg',progressive,...(chroma?{chromaSubsampling:chroma}: {})});
}
async function nativeSampler(surface:Surface, config:Recipe, sourceDirectory:string, manifest:RecordValue):Promise<{sampler:NativeSampler; source:RecordValue}> {
  const source=sourceRecord(manifest,surface.source); await verifySourcePin(sourceDirectory,source);
  if(surface.science?.kind==='terrestrial-observation') {
    const plan=parseSolidObservation({id:surface.id,...surface.science});
    if(!plan.nativePhotographicSampling||plan.textureScale) throw new Error(`Selected terrestrial photograph is not directly eligible: ${surface.id}.`);
    if(requireString(surface.science.input)!==source.id) throw new Error(`Selected observation and pinned source disagree: ${surface.id}.`);
    const primary=await loadNativePhotograph(sourceDirectory,source,plan.validity);
    if(!plan.monochromeBase)return {sampler:primary,source};
    const bases=config.surfaces.filter(candidate=>candidate.id===plan.monochromeBase);
    if(bases.length!==1||bases[0]!.science?.kind!=='terrestrial-observation') throw new Error(`Missing terrestrial monochrome base for ${surface.id}.`);
    const base=await nativeSampler(bases[0]!,config,sourceDirectory,manifest);
    return {sampler:{sample(longitudeDegrees,latitudeDegrees,color) { return primary.sample(longitudeDegrees,latitudeDegrees,color)||base.sampler.sample(longitudeDegrees,latitudeDegrees,color); }},source};
  }
  if(surface.science) {
    if(!surface.nativeSourcePoles) throw new Error(`Selected static observation has not opted into native poles: ${surface.id}.`);
    const plan=parseObservationLens({id:surface.id,input:surface.source,...surface.science,nativeSourcePoles:true});
    return {sampler:await loadNativeObservationPoleSampler(contained(sourceDirectory,surface.source),plan),source};
  }
  if(!surface.nativeSourcePoles) throw new Error(`Selected raw photograph has not opted into native poles: ${surface.id}.`);
  return {sampler:applyNativeSurfaceExposure(await loadNativeSourcePoleSampler(contained(sourceDirectory,surface.source)),surface.exposure),source};
}
function sourceContributors(surface:Surface, config:Recipe, manifest:RecordValue, seen=new Set<string>()):RecordValue[] {
  if(seen.has(surface.id)) throw new Error(`Circular photographic base: ${surface.id}.`);
  seen.add(surface.id);
  const sources=[sourceRecord(manifest,surface.source)];
  if(surface.science?.kind==='terrestrial-observation') {
    const plan=parseSolidObservation({id:surface.id,...surface.science});
    if(plan.monochromeBase) {
      const bases=config.surfaces.filter(candidate=>candidate.id===plan.monochromeBase);
      if(bases.length!==1) throw new Error(`Missing terrestrial monochrome base for ${surface.id}.`);
      sources.push(...sourceContributors(bases[0]!,config,manifest,seen));
    }
  }
  return sources;
}

async function stagePoles({lens,config,sourceDirectory,manifest,stage,publicDirectory}:{lens:Surface;config:Recipe;sourceDirectory:string;manifest:RecordValue;stage:string;publicDirectory:string}) {
  if(config.polesCombined) throw new Error('Combined polar atlases are refreshed through the selected source-packed band path.');
  const {sampler}=await nativeSampler(lens,config,sourceDirectory,manifest), assets=[] as {filename:string;url:string;width:number;height:number;bytes:number;sha256:string}[];
  for(const density of config.densities) {
    const tile=config.polarTile*density, filename=outputName(config.polesOutput,density,lens.id), previous=contained(publicDirectory,filename);
    const old=await existingMetadata(previous);
    if(old&&(old.width!==tile*2||old.height!==tile)) throw new Error(`Existing pole dimensions changed: ${filename}`);
    const bytes=await sharp(createNativePhotographPolarSprite(tile,config.latitudeBands,sampler,missingCoverageColor),{raw:{width:tile*2,height:tile,channels:4}}).webp({lossless:true,effort:6}).toBuffer();
    const stagePath=resolve(stage,filename); await writeFile(stagePath,bytes);
    const staged=await fingerprint(stagePath); if(staged.bytes!==bytes.length||staged.sha256!==sha256(bytes)) throw new Error(`Staged pole hash drifted: ${filename}`);
    const current=await sharp(stagePath).metadata();
    if(current.width!==tile*2||current.height!==tile||(old&&(current.width!==old.width||current.height!==old.height))) throw new Error(`Staged pole dimensions changed: ${filename}`);
    assets.push({filename,url:config.publicBase+filename,width:current.width!,height:current.height!,bytes:bytes.length,sha256:sha256(bytes)});
  }
  return assets;
}
async function stageMercuryBand({lens,config,sourceDirectory,manifest,stage,publicDirectory}:{lens:Surface;config:Recipe;sourceDirectory:string;manifest:RecordValue;stage:string;publicDirectory:string}) {
  if(config.resample!=='source-packed'||!config.unpackedResizeBeforePack||!config.polesCombined) throw new Error('Selected source-packed raster has not opted into unpacked resize-before-pack.');
  const source=sourceRecord(manifest,lens.source),verified=await verifySourcePin(sourceDirectory,source); let pixels=await readSourceRgba(verified.path,config.sourceWidth,config.sourceHeight);
  if(lens.coverage) {
    const normal=sourceRecord(manifest,lens.coverage.normal),topography=sourceRecord(manifest,lens.coverage.topography);
    const [normalFile,topographyFile]=await Promise.all([verifySourcePin(sourceDirectory,normal),verifySourcePin(sourceDirectory,topography)]);
    const completed=completeEnhancedCoverage(pixels,await readSourceRgba(normalFile.path,config.sourceWidth,config.sourceHeight),await readSourceRgba(topographyFile.path,config.sourceWidth,config.sourceHeight),{width:config.sourceWidth,height:config.sourceHeight},lens.coverage.references);
    pixels=completed.rgba;
  }
  const assets=[] as {filename:string;url:string;width:number;height:number;bytes:number;sha256:string}[];
  for(const density of config.densities) {
    const width=config.width*density,height=config.height*density;
    const target=width===config.sourceWidth&&height===config.sourceHeight?pixels:await sharp(Buffer.from(pixels),{raw:{width:config.sourceWidth,height:config.sourceHeight,channels:4}}).resize(width,height,{kernel:'lanczos3'}).raw().toBuffer();
    if(target.length!==width*height*4) throw new Error(`Unpacked resize dimensions changed: ${lens.id}.`);
    const packed=packLatitudeRaster(target,width,height,config.latitudeBands,Math.max(2,height/config.latitudeBands/4)), filename=outputName(lens.output,density,lens.id), previous=contained(publicDirectory,filename);
    const old=await existingMetadata(previous), bytes=await encodeBand(sharp(packed.data,{raw:{width:packed.packedWidth,height:packed.packedHeight,channels:4}}),lens.encoding,density).toBuffer();
    const stagePath=resolve(stage,filename); await writeFile(stagePath,bytes);
    const staged=await fingerprint(stagePath); if(staged.bytes!==bytes.length||staged.sha256!==sha256(bytes)) throw new Error(`Staged band hash drifted: ${filename}`);
    const current=await sharp(stagePath).metadata();
    if(current.width!==packed.packedWidth||current.height!==packed.packedHeight||(old&&(old.width!==current.width||old.height!==current.height))) throw new Error(`Staged band dimensions changed: ${filename}`);
    assets.push({filename,url:config.publicBase+filename,width:current.width!,height:current.height!,bytes:bytes.length,sha256:sha256(bytes)});
  }
  return assets;
}

export async function refreshSpherePhotographs(id:string,lensId:string) {
  if(!/^[a-z][a-z0-9-]*$/.test(id)||!/^[a-z][a-z0-9-]*$/.test(lensId)) throw new TypeError('Use one body id and one lens id.');
  sharp.cache(false);sharp.concurrency(1);
  const objectDirectory=resolve('src/objects',id),sourceDirectory=resolve(objectDirectory,'source'),publicDirectory=resolve('public/scenes',id),stage=resolve('output/sphere-photographs',id,lensId);
  const [sourceManifest,rasterRecipe,descriptor,scene]=await Promise.all([json(resolve(sourceDirectory,'manifest.json')),json(resolve(sourceDirectory,'preparation/raster.json')),json(resolve(objectDirectory,'object.json')),readFile(resolve(objectDirectory,'prepared/scene.json'))]);
  const config=recipe(rasterRecipe),lens=config.surfaces.filter(surface=>surface.id===lensId);
  if(lens.length!==1) throw new Error(`Unknown raster lens: ${id}/${lensId}.`);
  const recipePath=resolve(sourceDirectory,'preparation/raster.json'),recipePin=await fingerprint(recipePath),descriptorRecipe=requireArray(requireRecord(requireRecord(descriptor.properties).recipe).sources).map(value=>requireRecord(value)).find(source=>source.id==='raster');
  if(!descriptorRecipe||requireString(descriptorRecipe.path)!=='source/preparation/raster.json') throw new Error('Object descriptor does not name the selected raster recipe.');
  if(![...requireArray(sourceManifest.inputs).map(value=>requireRecord(value)),...requireArray(sourceManifest.documents).map(value=>requireRecord(value))].some(source=>source.path==='preparation/raster.json')) throw new Error('Source manifest does not declare the selected raster recipe.');
  await mkdir(stage,{recursive:true});
  const assets=config.resample==='source-packed' ? await stageMercuryBand({lens:lens[0]!,config,sourceDirectory,manifest:sourceManifest,stage,publicDirectory}) : await stagePoles({lens:lens[0]!,config,sourceDirectory,manifest:sourceManifest,stage,publicDirectory});
  const selected=sourceContributors(lens[0]!,config,sourceManifest), selectedFiles=await Promise.all(selected.map(source=>verifySourcePin(sourceDirectory,source)));
  const inputs:Record<string,string>={
    [repositoryPath(resolve(sourceDirectory,'manifest.json'))]:(await fingerprint(resolve(sourceDirectory,'manifest.json'))).sha256,
    [repositoryPath(recipePath)]:recipePin.sha256,
    [repositoryPath(resolve(objectDirectory,'prepared/scene.json'))]:sha256(scene)
  };
  for(const selectedFile of selectedFiles) inputs[repositoryPath(selectedFile.path)]=selectedFile.actual.sha256;
  if(lens[0]!.coverage) for(const path of [lens[0]!.coverage!.normal,lens[0]!.coverage!.topography]) { const source=sourceRecord(sourceManifest,path),file=await verifySourcePin(sourceDirectory,source); inputs[repositoryPath(file.path)]=file.actual.sha256; }
  const receipt={schema:'cssearth-sphere-photograph-stage@1',id,inputs,assets};
  await writeFile(resolve(stage,'receipt.json'),JSON.stringify(receipt,null,2)+'\n');
  return receipt;
}
if(process.argv[1]&&['refresh-sphere-photographs.mts','refresh-sphere-photographs.js'].includes(basename(process.argv[1]))) {
  const [id,lensId,...extra]=process.argv.slice(2);if(!id||!lensId||extra.length) throw new TypeError('Usage: refresh-sphere-photographs <body-id> <lens-id>.');
  console.log(JSON.stringify(await refreshSpherePhotographs(id,lensId)));
}
