import { sha256 } from '../../../src/platform/sha256.mts';
import {readAuthoredSources} from '../authored-sources.ts';
import {parse} from '../material-composition/data-schema.mts';
import {bandedGeometryRecipe} from './geometry-contract.mts';
import {normalizedPresentationRecipe} from './normalized-presentation-contract.mts';
import {layeredPresentationRecipe} from './presentation-contract.mts';
import {parseEllipsoidMaterialRecipe} from './materials.mts';
import {parsePhotometricDiscRecipe} from './photometric-disc.mts';
import {parseObservedSurfaceRecipe} from '../observed-surfaces/index.mts';
import {parseObservedPolarRecipe} from '../giant-observations/index.mts';
import {shape,text,number,optional,array} from '../terrestrial-layers/source-records.mts';
import {isRecord,requireRecord,requireFiniteNumber} from '../../sources/source-values.mts';
import {createSourceManifest} from '../../../src/platform/source-manifest.mts';
import type {prepareObjectContentAssets} from '../content/prepare.ts';
import {mkdir,readFile,writeFile,realpath} from 'node:fs/promises';
import {resolve,relative,sep} from 'node:path';
import {parseAuthoredObjectDescriptor} from '@cssearth/objects';
import {prepareCubicSky} from '../../../src/platform/prepare-cubic-sky-source.mts';
import {prepareDirectionalSun} from '../../../src/platform/prepare-directional-sun.mts';
import {CUBIC_SKY_CAMERA_PRESENTATION_STANDARD} from '../../../src/platform/cubic-sky-contract.mts';
import {requirePreparedPresentation} from '../../../src/platform/prepared-presentation-contract.mts';
import {prepareGiantLayers,parseRadialLayerRecipe,rasterAnnularField} from './index.mts';
import {prepareObservedSurfaces} from '../observed-surfaces/index.mts';
import {prepareEllipsoidMaterials} from './materials.mts';
import {prepareBandedEllipsoid} from './geometry.mts';
import {prepareLayeredSurfacePresentation} from './presentation.mts';
import {preparePhotometricDisc} from './photometric-disc.mts';
import {prepareNormalizedDiscPresentation} from './normalized-disc-presentation.mts';
import {prepareObservedPolarSurfaces} from '../giant-observations/index.mts';
import {withFocusedCamera} from '../focused-camera.mts';


const readJson=async (path:string):Promise<unknown>=>JSON.parse(await readFile(path,'utf8'));
const writeJson=(path:string,value:unknown)=>writeFile(path,`${JSON.stringify(value)}\n`);
export const isLayeredGiantRecipe=(value:unknown)=>isRecord(value)&&value.schema==='cssearth-banded-ellipsoid@1';

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

/** A giant's sky orientation and directional Sun; the shared universe draws the visible sky and Sun. */
export function prepareSharedCelestial(namespace:string) {
  return {sky:prepareCubicSky({objectId:namespace,cameraContract:CUBIC_SKY_CAMERA_PRESENTATION_STANDARD}),sun:prepareDirectionalSun()};
}

/** Full source regeneration. publicDirectory/outputDirectory are explicitly
 * supplied preparation destinations, never implicitly canonical asset roots. */
export async function prepareLayeredGiantObject({objectDirectory,publicDirectory,outputDirectory,write=false,prepareContent}: {objectDirectory:string;publicDirectory:string;outputDirectory:string;write?:boolean;prepareContent:typeof prepareObjectContentAssets}) {
  if(typeof prepareContent!=='function')throw new TypeError('Shared content preparation capability is required.');
  const root=await realpath(objectDirectory),sourceDirectory=resolve(root,'source'),raw=await readJson(resolve(root,'object.json')),{descriptor,sources}=await readAuthoredSources(root,raw);
  if(!write&&resolve(publicDirectory)===resolve(root,'../../../public/scenes',descriptor.id))throw new Error('Read-only source comparison cannot target canonical public assets.');
  const requiredSource=(id:string)=>{const source=sources.get(id);if(!source)throw new Error(`Layered giant source ${id} is missing.`);return source;};
  const required=(id:string)=>requiredSource(id).value;
  const geometryConfig=parse(required('geometry'),bandedGeometryRecipe,'banded geometry');
  const observationInput=required('observations'),materialInput=required('materials');
  const observationConfig=requireRecord(observationInput).schema==='cssearth-observed-polar-surfaces@1'?parseObservedPolarRecipe(observationInput):parseObservedSurfaceRecipe(observationInput);
  const materialConfig=requireRecord(materialInput).schema==='cssearth-photometric-disc@1'?parsePhotometricDiscRecipe(materialInput):parseEllipsoidMaterialRecipe(materialInput);
  const presentationConfig=materialConfig.schema==='cssearth-photometric-disc@1'?parse(required('presentation'),normalizedPresentationRecipe,'normalized presentation'):parse(required('presentation'),layeredPresentationRecipe,'layered presentation');
  const contentConfig=shape({id:text,displayName:text})(required('content')),radialConfig=parseRadialLayerRecipe(required('rings'));
  const normalizedDisc=materialConfig.schema==='cssearth-photometric-disc@1';
  if(!isLayeredGiantRecipe(geometryConfig)||presentationConfig.namespace!==descriptor.id||contentConfig.id!==descriptor.id)throw new TypeError('Authored capability identity differs.');
  const ids=descriptor.recipe.surfaces.flatMap(surface=>surface.lenses.map(lens=>lens.id));
  if(JSON.stringify(ids)!==JSON.stringify(observationConfig.lenses.map(lens=>lens.id))||JSON.stringify(ids)!==JSON.stringify((normalizedDisc?shape({lenses:array(shape({id:text}))})(presentationConfig).lenses:materialConfig.lenses).map(lens=>lens.id)))throw new TypeError('Authored lenses disagree across preparation capabilities.');
  const materialShape=normalizedDisc?materialConfig.shape:materialConfig.raster.shape;
  const materialPolar=normalizedDisc?Number(geometryConfig.shape.polarRadius.toFixed(materialConfig.shapePrecisionDigits)):geometryConfig.shape.polarRadius;
  if(descriptor.recipe.shape.kind!=='ellipsoid'||descriptor.recipe.shape.polarRadiusKm===undefined||geometryConfig.shape.equatorialRadius!==materialShape.equatorialRadius||materialPolar!==materialShape.polarRadius||geometryConfig.shape.polarRadius!==geometryConfig.shape.equatorialRadius*descriptor.recipe.shape.polarRadiusKm/descriptor.recipe.shape.radiusKm)throw new TypeError('Authored physical shape differs between source capabilities.');
  assertLayeredGiantFrameBank(descriptor,materialConfig,presentationConfig);
  const sourceManifest=await createSourceManifest({objectId:descriptor.id,objectName:contentConfig.displayName,sourceRoot:sourceDirectory});await sourceManifest.verify();
  await Promise.all([mkdir(publicDirectory,{recursive:true}),mkdir(outputDirectory,{recursive:true})]);
  const geometry=prepareBandedEllipsoid(geometryConfig);
  const observed=await (observationConfig.schema==='cssearth-observed-polar-surfaces@1'?prepareObservedPolarSurfaces:prepareObservedSurfaces)({sourceDirectory,publicDirectory,config:observationConfig,write:true});
  const radial=await prepareGiantLayers({sourceDirectory,publicDirectory,config:radialConfig,write:true});
  let radialLayer;
  if ('radialLayer' in materialConfig && materialConfig.radialLayer) {const layer=radialConfig.layers[materialConfig.radialLayer.layerIndex];if(!layer||layer.kind!=='annular-field')throw new TypeError('Material radial layer must bind an annular field.');radialLayer={...materialConfig.radialLayer,data:rasterAnnularField(layer,materialConfig.radialLayer.size)};}
  const material=normalizedDisc?await preparePhotometricDisc({sourceDirectory,config:materialConfig,publicDirectory,write:true}):await prepareEllipsoidMaterials({config:materialConfig,maps:observed.maps,radialLayer,publicDirectory,write:true});
  const celestial=prepareSharedCelestial(descriptor.id);
  const content=await prepareContent({sourceDirectory,publicDirectory,outputDirectory,config:{contentPath:relative(sourceDirectory,requiredSource('content').path),chartsPath:relative(sourceDirectory,requiredSource('charts').path)}});
  const rawPresentation=await (normalizedDisc?prepareNormalizedDiscPresentation:prepareLayeredSurfacePresentation)({config:presentationConfig,geometryConfig,geometry,observationConfig,materialConfig,sky:celestial.sky,sun:celestial.sun});
  const presentation=withFocusedCamera(rawPresentation,celestial.sky);
  requirePreparedPresentation(presentation,{controls:content.controls});
  const definition={...presentation,schema:'cssearth-object-runtime@4',id:descriptor.id,controls:content.controls};
  const assetIdentity=<T extends {data?:Uint8Array;filename:string}>({data,...asset}:T)=>({...asset,url:`/scenes/${descriptor.id}/${asset.filename}`});
  const raster={schema:'cssearth-prepared-layered-raster@1',observations:observed.assets.map(assetIdentity),radial:radial.assets.map(assetIdentity),materials:material.assets.map(assetIdentity)};
  const scene={schema:'cssearth-prepared-layered-scene@1',...geometry};
  await Promise.all([writeJson(resolve(outputDirectory,'runtime.json'),definition),writeJson(resolve(outputDirectory,'scene.json'),scene),writeJson(resolve(outputDirectory,'sky.json'),celestial.sky),writeJson(resolve(outputDirectory,'sun.json'),celestial.sun),writeJson(resolve(outputDirectory,'assets.json'),raster),writeJson(resolve(outputDirectory,'authored-preparation.json'),{schema:'cssearth-authored-preparation@1',id:descriptor.id,sources:descriptor.recipe.sources,lanes:{raster:true,celestial:true,geometry:true,content:true,presentation:true}})]);
  return {descriptor,sources,raster,celestial,scene,definition,content};
}
