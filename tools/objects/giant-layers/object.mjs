import {createHash} from 'node:crypto';
import {mkdir,readFile,writeFile,realpath} from 'node:fs/promises';
import {resolve,relative,sep} from 'node:path';
import {parseAuthoredObjectDescriptor} from '@cssearth/objects';
import {verifySourceManifest} from '../../../src/platform/source-manifest.mjs';
import {preparePlanetCubicSky} from '../../../src/platform/prepare-cubic-sky-source.mjs';
import {preparePlanetDirectionalSun} from '../../../src/platform/prepare-directional-sun.mjs';
import {CUBIC_SKY_CAMERA_PRESENTATION_STANDARD,CUBIC_SKY_POINT_SOURCE_PRESENTATION_STANDARD} from '../../../src/platform/cubic-sky-contract.mjs';
import {requirePreparedPresentation} from '../../../src/platform/prepared-presentation-contract.mjs';
import {prepareGiantLayers,parseRadialLayerRecipe,rasterAnnularField} from './index.mjs';
import {prepareObservedSurfaces} from './observations.mjs';
import {prepareEllipsoidMaterials} from './materials.mjs';
import {prepareBandedEllipsoid} from './geometry.mjs';
import {prepareLayeredSurfacePresentation} from './presentation.mjs';
import {preparePhotometricDisc} from './photometric-disc.mjs';
import {prepareNormalizedDiscPresentation} from './normalized-disc-presentation.mjs';
import {prepareObservedPolarSurfaces} from '../giant-observations/index.mjs';

const hash=bytes=>createHash('sha256').update(bytes).digest('hex');
const readJson=async path=>JSON.parse(await readFile(path,'utf8'));
const writeJson=(path,value)=>writeFile(path,`${JSON.stringify(value)}\n`);
export const isLayeredGiantRecipe=value=>value?.schema==='cssearth-banded-ellipsoid@1';

/** The authored residency declaration must describe the bank actually compiled. */
export function assertLayeredGiantFrameBank(descriptor,materialConfig,presentationConfig) {
  const normalizedDisc=materialConfig.schema==='cssearth-photometric-disc@1',bank=materialConfig.bank;
  const frames=bank.frames,rows=Math.ceil(frames/(normalizedDisc?bank.framesPerRow:bank.columns));
  const residentRows=normalizedDisc?bank.maximumRetainedRows:presentationConfig.material.capacity;
  const declared=descriptor.recipe.frameBanks;
  if(declared?.length!==1||declared[0].source!=='materials'||declared[0].frames!==frames||declared[0].rows!==rows||declared[0].residentRows!==residentRows||
      !descriptor.recipe.materials.some(material=>material.source===declared[0].source&&material.frameBank===declared[0].id))throw new TypeError('Authored frame bank differs from compiled material frames, rows or residency.');
  if(!normalizedDisc&&presentationConfig.resources.pools.find(pool=>pool.id===presentationConfig.resources.rowPool)?.options.capacity!==residentRows)throw new TypeError('Authored material residency differs from its row resource pool.');
}

export async function prepareSharedCelestial({sourceDirectory,publicDirectory,config}) {
  if(config?.schema!=='cssearth-shared-celestial@1'||!Number.isFinite(config.meanHeliocentricDistanceAu)||config.meanHeliocentricDistanceAu<=0||!config.namespace)throw new TypeError('Invalid shared celestial source.');
  const ensureDirectories=()=>mkdir(publicDirectory,{recursive:true});
  const sky=await preparePlanetCubicSky({objectId:config.namespace,sourceRoot:sourceDirectory,publicRoot:publicDirectory,ensureDirectories,validateSourceGroup:async()=>undefined,includeSun:false,cameraContract:CUBIC_SKY_CAMERA_PRESENTATION_STANDARD,pointSourceContract:CUBIC_SKY_POINT_SOURCE_PRESENTATION_STANDARD,writeModule:false});
  const sun=await preparePlanetDirectionalSun({objectId:config.namespace,publicRoot:publicDirectory,ensureDirectories,meanHeliocentricDistanceAu:config.meanHeliocentricDistanceAu,writeModule:false});
  return JSON.parse(JSON.stringify({sky,sun}));
}

/** Full source regeneration. publicDirectory/outputDirectory are explicitly
 * supplied preparation destinations, never implicitly canonical asset roots. */
export async function prepareLayeredGiantObject({objectDirectory,publicDirectory,outputDirectory,write=false,prepareContent}) {
  if(typeof prepareContent!=='function')throw new TypeError('Shared content preparation capability is required.');
  const root=await realpath(objectDirectory),sourceDirectory=resolve(root,'source'),raw=await readJson(resolve(root,'object.json')),descriptor=parseAuthoredObjectDescriptor(raw),sources=new Map();
  if(!write&&resolve(publicDirectory)===resolve(root,'../../../public/scenes',descriptor.id))throw new Error('Read-only source comparison cannot target canonical public assets.');
  for(const reference of descriptor.recipe.sources){
    const path=await realpath(resolve(root,reference.path)),offset=relative(root,path);if(offset==='..'||offset.startsWith(`..${sep}`)||offset.startsWith(sep))throw new Error('Authored source escapes object directory.');
    const bytes=await readFile(path);if(hash(bytes)!==reference.sha256)throw new Error(`Authored source pin mismatch: ${reference.path}`);sources.set(reference.id,{reference,path,value:JSON.parse(bytes.toString('utf8'))});
  }
  const required=id=>{if(!sources.has(id))throw new Error(`Layered giant source ${id} is missing.`);return sources.get(id).value;};
  const geometryConfig=required('geometry'),observationConfig=required('observations'),materialConfig=required('materials'),presentationConfig=required('presentation'),celestialConfig=required('celestial'),contentConfig=required('content'),radialConfig=parseRadialLayerRecipe(required('rings'));
  const normalizedDisc=materialConfig.schema==='cssearth-photometric-disc@1';
  if(!isLayeredGiantRecipe(geometryConfig)||presentationConfig.namespace!==descriptor.id||celestialConfig.namespace!==descriptor.id||contentConfig.id!==descriptor.id)throw new TypeError('Authored capability identity differs.');
  const ids=descriptor.recipe.surfaces.flatMap(surface=>surface.lenses.map(lens=>lens.id));
  if(JSON.stringify(ids)!==JSON.stringify(observationConfig.lenses.map(lens=>lens.id))||JSON.stringify(ids)!==JSON.stringify((normalizedDisc?presentationConfig.lenses:materialConfig.lenses).map(lens=>lens.id)))throw new TypeError('Authored lenses disagree across preparation capabilities.');
  const materialShape=normalizedDisc?materialConfig.shape:materialConfig.raster.shape;
  const materialPolar=normalizedDisc?Number(geometryConfig.shape.polarRadius.toFixed(materialConfig.shapePrecisionDigits)):geometryConfig.shape.polarRadius;
  if(descriptor.recipe.shape.kind!=='ellipsoid'||geometryConfig.shape.equatorialRadius!==materialShape.equatorialRadius||materialPolar!==materialShape.polarRadius||geometryConfig.shape.polarRadius!==geometryConfig.shape.equatorialRadius*descriptor.recipe.shape.polarRadiusKm/descriptor.recipe.shape.radiusKm)throw new TypeError('Authored physical shape differs between source capabilities.');
  assertLayeredGiantFrameBank(descriptor,materialConfig,presentationConfig);
  const manifest=await readJson(resolve(sourceDirectory,'manifest.json'));await verifySourceManifest({manifest,planetName:contentConfig.displayName,sourceRoot:sourceDirectory});
  await Promise.all([mkdir(publicDirectory,{recursive:true}),mkdir(outputDirectory,{recursive:true})]);
  const geometry=prepareBandedEllipsoid(geometryConfig);
  const observed=await (observationConfig.schema==='cssearth-observed-polar-surfaces@1'?prepareObservedPolarSurfaces:prepareObservedSurfaces)({sourceDirectory,publicDirectory,config:observationConfig,write:true});
  const radial=await prepareGiantLayers({sourceDirectory,publicDirectory,config:radialConfig,write:true});
  const radialLayer=materialConfig.radialLayer?{...materialConfig.radialLayer,data:rasterAnnularField(radialConfig.layers[materialConfig.radialLayer.layerIndex],materialConfig.radialLayer.size)}:undefined;
  const material=normalizedDisc?await preparePhotometricDisc({sourceDirectory,config:materialConfig,publicDirectory,write:true}):await prepareEllipsoidMaterials({config:materialConfig,maps:observed.maps,radialLayer,publicDirectory,write:true});
  const celestial=await prepareSharedCelestial({sourceDirectory,publicDirectory,config:celestialConfig});
  const content=await prepareContent({sourceDirectory,publicDirectory,outputDirectory,config:{contentPath:relative(sourceDirectory,sources.get('content').path),chartsPath:relative(sourceDirectory,sources.get('charts').path)}});
  const presentation=await (normalizedDisc?prepareNormalizedDiscPresentation:prepareLayeredSurfacePresentation)({config:presentationConfig,geometryConfig,geometry,observationConfig,materialConfig,sky:celestial.sky,sun:celestial.sun});
  requirePreparedPresentation(presentation,{controls:content.controls});
  const definition={...presentation,schema:'cssearth-object-runtime@4',id:descriptor.id,controls:content.controls};
  const assetIdentity=({data,...asset})=>({...asset,url:`/scenes/${descriptor.id}/${asset.filename}`});
  const raster={schema:'cssearth-prepared-layered-raster@1',observations:observed.assets.map(assetIdentity),radial:radial.assets.map(assetIdentity),materials:material.assets.map(assetIdentity)};
  const scene={schema:'cssearth-prepared-layered-scene@1',...geometry};
  await Promise.all([writeJson(resolve(outputDirectory,'runtime.json'),definition),writeJson(resolve(outputDirectory,'scene.json'),scene),writeJson(resolve(outputDirectory,'sky.json'),celestial.sky),writeJson(resolve(outputDirectory,'sun.json'),celestial.sun),writeJson(resolve(outputDirectory,'assets.json'),raster),writeJson(resolve(outputDirectory,'authored-preparation.json'),{schema:'cssearth-authored-preparation@1',id:descriptor.id,sources:descriptor.recipe.sources,lanes:{raster:true,celestial:true,geometry:true,content:true,presentation:true}})]);
  return {descriptor,sources,raster,celestial,scene,definition,content};
}
