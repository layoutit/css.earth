import { OBJECT_RUNTIME_SCHEMA, parseAuthoredObjectDescriptor } from '@cssearth/objects';

import { readAuthoredSources } from '../../sources/index.ts';
import { parse } from '@cssearth/core/schema';
import { bandedGeometryRecipe } from './geometry-contract.ts';
import { normalizedPresentationRecipe } from './normalized-presentation-contract.ts';
import { layeredPresentationRecipe } from './presentation-contract.ts';
import { parsePhotometricDiscRecipe, preparePhotometricDisc } from './photometric-disc.ts';
import { prepareGiantLayers, parseRadialLayerRecipe } from './giant-layers.ts';
import { rasterAnnularField } from './rings.ts';
import { prepareBandedEllipsoid, domeRingWarp, type BandedImagePixels } from './geometry.ts';
import { prepareNormalizedDiscPresentation } from './normalized-disc-presentation.ts';
import { parseEllipsoidMaterialRecipe } from './ellipsoid-materials.ts';
import { parseObservedSurfaceRecipe, prepareObservedSurfaces } from '../observed-surfaces/index.ts';
import { parseObservedPolarRecipe } from './observed-polar.ts';
import { shape, text, number, optional, array, isRecord, requireRecord, requireFiniteNumber } from '@cssearth/core';
import { createSourceManifest } from '@cssearth/objects/node';
import type { ContentPreparationContext, PreparedObjectContentAssets } from '../../content/index.ts';
import { mkdir, readFile, writeFile, realpath } from 'node:fs/promises';
import { resolve, relative } from 'node:path';

import { BANDED_ELLIPSOID_SCHEMA, withFocusedCamera } from '../../scene/index.ts';
import { prepareCubicSky, prepareDirectionalSun } from '../../../presentation/index.ts';
import { CUBIC_SKY_CAMERA_PRESENTATION_STANDARD } from '../../../presentation/index.ts';
import { requirePreparedPresentation } from '../../../presentation/index.ts';
import { prepareEllipsoidMaterials } from './ellipsoid-materials.ts';
import { prepareLayeredSurfacePresentation } from './layered-surface-presentation.ts';
import { prepareObservedPolarSurfaces, polarImageProjection } from './observed-polar.ts';

const readJson=async (path:string):Promise<unknown>=>JSON.parse(await readFile(path,'utf8'));
const writeJson=(path:string,value:unknown)=>writeFile(path,`${JSON.stringify(value)}\n`);
export const isLayeredGiantRecipe=(value:unknown)=>isRecord(value)&&value.schema===BANDED_ELLIPSOID_SCHEMA;

/** The authored residency declaration must describe the bank actually compiled. */
export function assertLayeredGiantFrameBank(descriptor:Pick<ReturnType<typeof parseAuthoredObjectDescriptor>,'recipe'>,materialInput:unknown,presentationInput:unknown) {
  const materialConfig=shape({schema:text,bank:shape({frames:number,framesPerRow:optional(number),columns:optional(number),maximumRetainedRows:optional(number)})})(materialInput);
  const presentationConfig=shape({material:optional(shape({capacity:number})),resources:optional(shape({rowPool:text,pools:array(shape({id:text,options:shape({capacity:optional(number)})}))}))})(presentationInput);
  const normalizedDisc=materialConfig.schema==='cssearth-photometric-disc@1',bank=materialConfig.bank;
  const frames=bank.frames,rows=Math.ceil(frames/requireFiniteNumber(normalizedDisc?bank.framesPerRow:bank.columns));
  const residentRows=requireFiniteNumber(normalizedDisc?bank.maximumRetainedRows:presentationConfig.material?.capacity);
  const declared=descriptor.recipe.frameBanks;
  if(declared?.length!==1||declared[0].source!=='materials'||declared[0].frames!==frames||declared[0].rows!==rows||declared[0].residentRows!==residentRows||
      !descriptor.recipe.materials?.some(material=>material.source===declared[0].source&&material.frameBank===declared[0].id))throw new TypeError('Authored frame bank differs from compiled material frames, rows or residency.');
  if(!normalizedDisc&&presentationConfig.resources?.pools.find(pool=>pool.id===presentationConfig.resources?.rowPool)?.options.capacity!==residentRows)throw new TypeError('Authored material residency differs from its row resource pool.');
}

/** The part of an observation recipe that names each dataset's surface images. */
type DatasetSurfaceFiles={schema:'cssearth-observed-polar-surfaces@2';datasets:readonly {files:{surface:string;surface2x:string}}[]}|{schema:'cssearth-observed-surfaces@2';datasets:readonly {products:readonly {kind:string;filename:string}[]}[]};

/** The widths of the images the geometry's leaves show, read from what this run published: a surface face shows any dataset's
 * surface, a tiled plane its own image. */
export function publishedLeafImages(id:string,observations:DatasetSurfaceFiles,assets:readonly {filename:string;width:number}[]):BandedImagePixels {
  const widths=new Map(assets.map(asset=>[asset.filename,asset.width]));
  const width=(filename:string)=>{const value=widths.get(filename);if(value===undefined)throw new TypeError(`Layered giant ${id}: leaf image ${filename} was not published by this preparation.`);return value;};
  const surfaces=observations.schema==='cssearth-observed-polar-surfaces@2'?observations.datasets.flatMap(dataset=>[dataset.files.surface,dataset.files.surface2x]):observations.datasets.flatMap(dataset=>dataset.products.flatMap(product=>product.kind==='surface'?[product.filename]:[]));
  if(!surfaces.length)throw new TypeError(`Layered giant ${id}: no dataset publishes a surface image.`);
  const prefix=`/scenes/${id}/`;
  return{surface:Math.max(...surfaces.map(width)),image:url=>{if(!url.startsWith(prefix))throw new TypeError(`Layered giant ${id}: leaf image ${url} is not under ${prefix}.`);return width(url.slice(prefix.length));}};
}

/** A giant's sky orientation and directional Sun; the shared universe draws the visible sky and Sun. */
export function prepareSharedCelestial(namespace:string) {
  return {sky:prepareCubicSky({objectId:namespace,cameraContract:CUBIC_SKY_CAMERA_PRESENTATION_STANDARD}),sun:prepareDirectionalSun()};
}

/** Full source regeneration. publicDirectory/outputDirectory are explicitly
 * supplied preparation destinations, never implicitly canonical asset roots. */
export async function prepareLayeredGiantObject({objectDirectory,publicDirectory,outputDirectory,write=false,prepareContent}: {objectDirectory:string;publicDirectory:string;outputDirectory:string;write?:boolean;prepareContent:(context: ContentPreparationContext) => Promise<PreparedObjectContentAssets>}) {
  if(typeof prepareContent!=='function')throw new TypeError('Shared content preparation capability is required.');
  const root=await realpath(objectDirectory),sourceDirectory=resolve(root,'source'),raw=await readJson(resolve(root,'object.json')),{descriptor,sources}=await readAuthoredSources(root,raw);
  if(!write&&resolve(publicDirectory)===resolve(root,'../../../public/scenes',descriptor.id))throw new Error('Read-only source comparison cannot target canonical public assets.');
  const requiredSource=(id:string)=>{const source=sources.get(id);if(!source)throw new Error(`Layered giant source ${id} is missing.`);return source;};
  const required=(id:string)=>requiredSource(id).value;
  const geometryConfig=parse(required('geometry'),bandedGeometryRecipe,'banded geometry');
  const observationInput=required('observations'),materialInput=required('materials');
  const observationConfig=requireRecord(observationInput).schema==='cssearth-observed-polar-surfaces@2'?parseObservedPolarRecipe(observationInput):parseObservedSurfaceRecipe(observationInput);
  const materialConfig=requireRecord(materialInput).schema==='cssearth-photometric-disc@1'?parsePhotometricDiscRecipe(materialInput):parseEllipsoidMaterialRecipe(materialInput);
  const presentationConfig=materialConfig.schema==='cssearth-photometric-disc@1'?parse(required('presentation'),normalizedPresentationRecipe,'normalized presentation'):parse(required('presentation'),layeredPresentationRecipe,'layered presentation');
  const contentConfig=shape({id:text,displayName:text})(required('content')),radialConfig=parseRadialLayerRecipe(required('rings'));
  const normalizedDisc=materialConfig.schema==='cssearth-photometric-disc@1';
  if(!isLayeredGiantRecipe(geometryConfig)||presentationConfig.namespace!==descriptor.id||contentConfig.id!==descriptor.id)throw new TypeError('Authored capability identity differs.');
  const ids=descriptor.recipe.surfaces.flatMap(surface=>surface.datasets.map(dataset=>dataset.id));
  if(JSON.stringify(ids)!==JSON.stringify(observationConfig.datasets.map(dataset=>dataset.id))||JSON.stringify(ids)!==JSON.stringify((normalizedDisc?shape({datasets:array(shape({id:text}))})(presentationConfig).datasets:materialConfig.datasets).map(dataset=>dataset.id)))throw new TypeError('Authored datasets disagree across preparation capabilities.');
  const materialShape=normalizedDisc?materialConfig.shape:materialConfig.raster.shape;
  const materialPolar=normalizedDisc?Number(geometryConfig.shape.polarRadius.toFixed(materialConfig.shapePrecisionDigits)):geometryConfig.shape.polarRadius;
  if(descriptor.recipe.shape.kind!=='ellipsoid'||descriptor.recipe.shape.polarRadiusKm===undefined||geometryConfig.shape.equatorialRadius!==materialShape.equatorialRadius||materialPolar!==materialShape.polarRadius||geometryConfig.shape.polarRadius!==geometryConfig.shape.equatorialRadius*descriptor.recipe.shape.polarRadiusKm/descriptor.recipe.shape.radiusKm)throw new TypeError('Authored physical shape differs between source capabilities.');
  assertLayeredGiantFrameBank(descriptor,materialConfig,presentationConfig);
  const sourceManifest=await createSourceManifest({objectId:descriptor.id,objectName:contentConfig.displayName,sourceRoot:sourceDirectory});await sourceManifest.verify();
  await Promise.all([mkdir(publicDirectory,{recursive:true}),mkdir(outputDirectory,{recursive:true})]);
  // A dome's rings show the pole imagery the observation lane composites into their map rows, written for the rings' own
  // projective mapping; its caps show the pole tiles at their own projection.
  const dome=geometryConfig.polar.dome?domeRingWarp(geometryConfig):undefined;
  if(dome&&observationConfig.schema!=='cssearth-observed-polar-surfaces@2')throw new TypeError(`Layered giant ${descriptor.id}: a dome needs pole tiles from an observed polar recipe.`);
  if(dome&&JSON.stringify(observationConfig.schema==='cssearth-observed-polar-surfaces@2'?observationConfig.packing.latitudeBoundsDegrees:null)!==JSON.stringify(geometryConfig.latitudeBoundsDegrees))
    throw new TypeError(`Layered giant ${descriptor.id}: the dome's rings need the packed bands (observations packing.latitudeBoundsDegrees) to be the geometry's latitude bounds.`);
  const observed=observationConfig.schema==='cssearth-observed-polar-surfaces@2'?await prepareObservedPolarSurfaces({sourceDirectory,publicDirectory,config:observationConfig,write:true,...(dome?{dome}:{})}):await prepareObservedSurfaces({sourceDirectory,publicDirectory,config:observationConfig,write:true});
  const radial=await prepareGiantLayers({sourceDirectory,publicDirectory,config:radialConfig,write:true});
  const leafImages=publishedLeafImages(descriptor.id,observationConfig,[...observed.assets,...radial.assets]);
  const geometry=prepareBandedEllipsoid(geometryConfig,dome?{...leafImages,poles:polarImageProjection(observationConfig)}:leafImages);
  let radialLayer;
  if ('radialLayer' in materialConfig && materialConfig.radialLayer) {const layer=radialConfig.layers[materialConfig.radialLayer.layerIndex];if(!layer||layer.kind!=='annular-field')throw new TypeError('Material radial layer must bind an annular field.');radialLayer={...materialConfig.radialLayer,data:rasterAnnularField(layer,materialConfig.radialLayer.size)};}
  const material=normalizedDisc?await preparePhotometricDisc({sourceDirectory,config:materialConfig,publicDirectory,write:true}):await prepareEllipsoidMaterials({config:materialConfig,maps:observed.maps,radialLayer,publicDirectory,write:true});
  const celestial=prepareSharedCelestial(descriptor.id);
  const content=await prepareContent({sourceDirectory,publicDirectory,outputDirectory,config:{contentPath:relative(sourceDirectory,requiredSource('content').path),chartsPath:relative(sourceDirectory,requiredSource('charts').path)}});
  const rawPresentation=await (normalizedDisc?prepareNormalizedDiscPresentation:prepareLayeredSurfacePresentation)({config:presentationConfig,geometryConfig,geometry,observationConfig,materialConfig,sky:celestial.sky,sun:celestial.sun});
  const presentation=withFocusedCamera(rawPresentation,celestial.sky);
  requirePreparedPresentation(presentation,{controls:content.controls});
  const definition={...presentation,schema:OBJECT_RUNTIME_SCHEMA,id:descriptor.id,controls:content.controls};
  const assetIdentity=<T extends {data?:Uint8Array;filename:string}>({data,...asset}:T)=>({...asset,url:`/scenes/${descriptor.id}/${asset.filename}`});
  const raster={schema:'cssearth-prepared-layered-raster@1',observations:observed.assets.map(assetIdentity),radial:radial.assets.map(assetIdentity),materials:material.assets.map(assetIdentity)};
  const scene={schema:'cssearth-prepared-layered-scene@1',...geometry};
  await Promise.all([writeJson(resolve(outputDirectory,'runtime.json'),definition),writeJson(resolve(outputDirectory,'scene.json'),scene),writeJson(resolve(outputDirectory,'sky.json'),celestial.sky),writeJson(resolve(outputDirectory,'sun.json'),celestial.sun),writeJson(resolve(outputDirectory,'assets.json'),raster),writeJson(resolve(outputDirectory,'authored-preparation.json'),{schema:'cssearth-authored-preparation@1',id:descriptor.id,sources:descriptor.recipe.sources,lanes:{raster:true,celestial:true,geometry:true,content:true,presentation:true}})]);
  return {descriptor,sources,raster,celestial,scene,definition,content};
}
