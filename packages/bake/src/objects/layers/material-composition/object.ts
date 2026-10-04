import { AUTHORED_PREPARATION_SCHEMA, type AuthoredPreparationReceipt, OBJECT_RUNTIME_SCHEMA, PREPARED_CSS_OBJECT_FORMAT, parseAuthoredObjectDescriptor } from '@cssearth/objects';

import {readAuthoredSources} from '../../sources/index.ts';
import {parse} from '@cssearth/core/schema';

import { layeredRecipe } from './layered-recipe.ts';
import { spectralRecipe } from './spectral-recipe.ts';
import { radialMotionRecipe } from './radial-motion-recipe.ts';
import { layeredPresentationRecipe } from './presentation-recipe.ts';
import { prepareRadialMotionAndShadow } from './radial-motion.ts';
import { prepareSpectralMaterialVariants } from './spectral-variants.ts';
import { prepareLayeredLeafLayouts } from './leaf-layouts.ts';
import {cutawayRecipe} from '../cutaway/index.ts';
import { parseRadialLayerRecipe, prepareGiantLayers } from '../giant/index.ts';
import {shape,text,number,boolean,array,isRecord,requireRecord} from '@cssearth/core';
import { createSourceManifest, inventoryPublicAssets } from '@cssearth/objects/node';
import type {ContentPreparationContext, PreparedObjectContentAssets} from '../../content/index.ts';
import {mkdir,readFile,realpath,writeFile,rm} from 'node:fs/promises';
import {relative,resolve,sep} from 'node:path';
import {pathToFileURL} from 'node:url';
import sharp from 'sharp';

import { requirePreparedPresentation, CUBIC_SKY_CAMERA_PRESENTATION_STANDARD, prepareCubicSky, prepareDirectionalSun, prepareMaterialTracks } from '../../../presentation/index.ts';
import { LAYERED_OBLATE_SCHEMA, withFocusedCamera } from '../../scene/index.ts';
import { prepareCutawayMaterials } from './cutaway-materials.ts';
import { createLayeredOblatePreparation } from './layered-oblate.ts';
import { prepareLayeredOblatePresentation } from './presentation.ts';
import {parseObservedSurfaceRecipe,prepareObservedSurfaces} from '../observed-surfaces/index.ts';

const json=async (path:string):Promise<unknown>=>JSON.parse(await readFile(path,'utf8'));
const writeJson=(path:string,value:unknown)=>writeFile(path,JSON.stringify(value)+'\n');

export const isLayeredOblateRecipe=(value:unknown)=>isRecord(value)&&value.schema===LAYERED_OBLATE_SCHEMA;

/** A full source-to-consumer pipeline; no runtime product is a preparation input. */
export async function prepareLayeredOblateObject({objectDirectory,publicDirectory,outputDirectory,write=false,prepareContent}: {objectDirectory:string;publicDirectory:string;outputDirectory:string;write?:boolean;prepareContent:(context: ContentPreparationContext) => Promise<PreparedObjectContentAssets>}) {
  if(typeof prepareContent!=='function')throw new TypeError('Layered preparation requires the shared content compiler.');
  // Each phase can atomically replace a decoded image at the same path. The
  // previous separate-process pipeline never reused cached file-loader nodes.
  sharp.cache(false);
  const objectRoot=await realpath(objectDirectory),descriptorPath=resolve(objectRoot,'object.json');
  const rawDescriptor=requireRecord(await json(descriptorPath)),{descriptor,sources}=await readAuthoredSources(objectRoot,rawDescriptor);
  if(!write&&resolve(publicDirectory)===resolve(objectRoot,'../../../public/scenes',descriptor.id))throw new Error('Read-only source comparison cannot target canonical public assets.');
  const requiredSource=(id:string)=>{const source=sources.get(id);if(!source)throw new TypeError(`Layered preparation requires ${id}.`);return source;};
  const required=(id:string)=>requiredSource(id).value;
  const geometry=parse(required('geometry'),layeredRecipe,'layered geometry'),surface=parse(required('surface'),spectralRecipe,'spectral material'),materials=parse(required('materials'),cutawayRecipe,'cutaway material'),radialMotion=parse(required('radial-motion'),radialMotionRecipe,'radial motion'),rings=parseRadialLayerRecipe(required('rings')),presentationConfig=parse(required('presentation'),layeredPresentationRecipe,'layered presentation');
  const contentSource=shape({displayName:text,datasets:shape({controls:array(shape({id:text}))})})(required('content'));
  if(!isLayeredOblateRecipe(geometry)||[geometry,surface,materials,radialMotion,presentationConfig].some(config=>config.namespace!==descriptor.id))throw new TypeError('Authored capability identity differs.');
  if(descriptor.recipe.shape.kind!=='ellipsoid')throw new TypeError('Layered oblate preparation requires an ellipsoid.');
  if(descriptor.recipe.shape.radiusKm!==geometry.parameters.objectEquatorialRadiusKm||descriptor.recipe.shape.polarRadiusKm!==geometry.parameters.objectPolarRadiusKm)throw new TypeError('Authored ellipsoid shape differs from pinned preparation facts.');
  if(descriptor.recipe.shape.kind!=='ellipsoid'||!descriptor.recipe.rings)throw new TypeError('Layered oblate preparation requires declared ellipsoid and radial layer capabilities.');
  const declared=descriptor.recipe.surfaces.flatMap(surface=>surface.datasets.map(dataset=>dataset.id));
  if(JSON.stringify(declared)!==JSON.stringify(contentSource.datasets.controls.map(dataset=>dataset.id)))throw new TypeError('Authored datasets differ from content controls.');
  const sourceDirectory=resolve(objectRoot,'source');
  const sourceManifest=await createSourceManifest({objectId:descriptor.id,objectName:contentSource.displayName,sourceRoot:sourceDirectory});await sourceManifest.verify();
  await Promise.all([mkdir(publicDirectory,{recursive:true}),mkdir(outputDirectory,{recursive:true})]);
  const stagingDirectory=resolve(outputDirectory,'.material-masters');
  const context={sourceDirectory,publicDirectory,stagingDirectory};
  await prepareGiantLayers({...context,config:rings,write:true});
  const radial=await prepareRadialMotionAndShadow({...context,config:radialMotion,radialRecipe:rings});
  const baseCompiler=await createLayeredOblatePreparation({...context,config:geometry,preparedInputs:radial});
  const metadata=await baseCompiler.prepareBaseMaterialSurfaces();
  const materialDatasets=await prepareSpectralMaterialVariants({...context,config:surface});
  // Dated RGB observations share the body's visible-light material and rings.
  const observationSource=sources.get('observations');
  const observations=observationSource?parseObservedSurfaceRecipe(observationSource.value):null;
  if(observations)await prepareObservedSurfaces({...context,config:observations,write:true});
  const normal=materialDatasets.controls.find(dataset=>dataset.id===materialDatasets.defaultDataset);
  if(!normal)throw new Error('Layered observations require the default material.');
  const observedDatasets=(observations?.datasets??[]).map(dataset=>{
    const product=(kind:string)=>{
      const matches=dataset.products.filter(product=>product.kind===kind), selected=matches.find(product=>product.filename.includes('@2x'))??matches[0];
      if(!selected)throw new Error(`Observation ${dataset.id} has no ${kind} product.`);
      return `${geometry.publicPrefix}${selected.filename}`;
    };
    return {...normal,id:dataset.id,materialDataset:materialDatasets.defaultDataset,surfaceUrl:product('surface'),surface2xUrl:product('surface'),polesUrl:product('poles'),thumbnailUrl:product('thumbnail')};
  });
  const presentationDatasets={...materialDatasets,controls:[...materialDatasets.controls,...observedDatasets]};
  const views=await prepareCutawayMaterials({...context,config:materials,objectLightDirection:radial.ringSource.shadowModel.objectLightDirection});
  const compiler=await createLayeredOblatePreparation({...context,config:geometry,preparedInputs:{...radial,datasets:materialDatasets,views}});
  const material=await compiler.composeMaterialSurfaces(metadata);
  const {runtimeScene:scene}=await compiler.prepareLayeredScene(material);
  // The raw material masters only feed the composition above; they are not published, and prepared/ holds published files.
  await rm(stagingDirectory,{recursive:true,force:true});
  const sky=prepareCubicSky({objectId:descriptor.id,cameraContract:CUBIC_SKY_CAMERA_PRESENTATION_STANDARD});
  const sun=prepareDirectionalSun();
  const contentResult=await prepareContent({sourceDirectory,publicDirectory,outputDirectory,config:{contentPath:relative(sourceDirectory,requiredSource('content').path)}});
  const {controls,content}=contentResult;
  const projectRoot=resolve(objectRoot,'../../..'),stylesheetPath=resolve(projectRoot,presentationConfig.stylesheet.path);
  if(relative(projectRoot,stylesheetPath).startsWith('..'))throw new TypeError('Layered stylesheet escapes project.');
  const stylesheet=await readFile(stylesheetPath,'utf8');
  const layouts=prepareLayeredLeafLayouts({scene,stylesheet,config:presentationConfig});
  const raw=await prepareLayeredOblatePresentation({publicDirectory,config:presentationConfig,plan:scene,layouts,datasets:presentationDatasets,views,sky,sun});
  const normalizedPresentation={...raw,materials:prepareMaterialTracks(raw),variants:raw.variants.map(variant=>({...variant,materials:variant.materials.map(material=>({...material,mode:material.mode==='default-pose'?'frames':material.mode}))}))};
  const presentation=withFocusedCamera(normalizedPresentation,sky);
  requirePreparedPresentation(presentation,{controls});
  const definition={...presentation,schema:OBJECT_RUNTIME_SCHEMA,id:descriptor.id,controls};
  // Only consumer-used scene data is published. Dormant moon/orbit generators,
  // raw masters and diagnostic shader metadata are not runtime dependencies.
  const values={scene,sky,sun,runtime:definition,'material-datasets':presentationDatasets,views,layouts};
  for(const[name,value]of Object.entries(values))await writeJson(resolve(outputDirectory,`${name}.json`),value);
  await prepareLayeredConsumerManifest({id:descriptor.id,definition,content,stylesheet,publicDirectory,objectDirectory:write?objectRoot:outputDirectory});
  // The prepared/object.json transport is built from runtime.json when read (@cssearth/objects/node prepared-transport).
  if(write) {
    await writeFile(descriptorPath,JSON.stringify({...rawDescriptor,prepared:{format:PREPARED_CSS_OBJECT_FORMAT,url:'prepared/object.json'}},null,2)+'\n');
  }
  await writeJson(resolve(outputDirectory,'authored-preparation.json'),{schema:AUTHORED_PREPARATION_SCHEMA,id:descriptor.id,sources:[...sources.values()].map(source=>source.reference),lanes:{radial:true,materials:true,geometry:true,content:true,celestial:true,presentation:true}} satisfies AuthoredPreparationReceipt);
  return {descriptor,sources,raster:surface,celestial:{sky,sun},scene,definition,content};
}

/** Preparation may retain intermediate density banks; deployed closure is exact. */
export function prepareLayeredConsumerManifest({id,definition,content,stylesheet,publicDirectory,objectDirectory}: {id:string;definition:unknown;content:unknown;stylesheet:string;publicDirectory:string;objectDirectory:string}) {
  const urls=collectUrls(id,[definition,content,stylesheet]);
  return inventoryPublicAssets({objectId:id,objectDirectory,urls,publicRoot:publicDirectory,allowPreparationArtifacts:true});
}

function collectUrls(id:string,values:readonly unknown[]) {
  const prefix=`/scenes/${id}/`,urls=new Set<string>();
  const visit=(value:unknown):void=>{
    if(typeof value==='string') {
      if(value.startsWith(prefix)&&!/[\s;()"']/.test(value))urls.add(value);
      for(const match of value.matchAll(/url\(\s*["']?(\/scenes\/[^\s)"']+)["']?\s*\)/gu))if(match[1].startsWith(prefix))urls.add(match[1]);
    }else if(Array.isArray(value))value.forEach(visit);else if(value&&typeof value==='object')Object.values(value).forEach(visit);
  };
  visit(values);return[...urls].sort();
}
