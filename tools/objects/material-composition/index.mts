import { sha256 } from '../../../src/platform/sha256.mts';
import {readAuthoredSources} from '../authored-sources.ts';
import {parse} from './data-schema.mts';
import {PREPARED_CSS_OBJECT_FORMAT} from '../../../src/renderers/css/dist/index.js';
import {layeredRecipe} from './layered-recipe.mts';
import {spectralRecipe} from './spectral-recipe.mts';
import {radialMotionRecipe} from './radial-motion-recipe.mts';
import {layeredPresentationRecipe} from './presentation-recipe.mts';
import {cutawayRecipe} from '../cutaway/recipe-contract.mts';
import {parseRadialLayerRecipe} from '../giant-layers/index.mts';
import {shape,text,number,boolean,array} from '../terrestrial-layers/source-records.mts';
import {isRecord,requireRecord} from '../../sources/source-values.mts';
import {createSourceManifest} from '../../../src/platform/source-manifest.mts';
import type {prepareObjectContentAssets} from '../content/prepare.ts';
import {mkdir,readFile,realpath,writeFile} from 'node:fs/promises';
import {relative,resolve,sep} from 'node:path';
import {pathToFileURL} from 'node:url';
import sharp from 'sharp';
import {parseAuthoredObjectDescriptor} from '@cssearth/objects';
import {inventoryPublicAssets} from '../../../src/platform/runtime-asset-closure.mts';
import {requirePreparedPresentation} from '../../../src/platform/prepared-presentation-contract.mts';
import {CUBIC_SKY_CAMERA_PRESENTATION_STANDARD} from '../../../src/platform/cubic-sky-contract.mts';
import {preparePlanetCubicSky} from '../../../src/platform/prepare-cubic-sky-source.mts';
import {preparePlanetDirectionalSun} from '../../../src/platform/prepare-directional-sun.mts';
import {prepareMaterialTracks} from '../../prepare/prepare-materials.mts';
import {prepareGiantLayers} from '../giant-layers/index.mts';
import {prepareCutawayMaterials} from '../cutaway/materials.mts';
import {createLayeredOblatePreparation} from './layered-oblate.mts';
import {prepareRadialMotionAndShadow} from './radial-motion.mts';
import {prepareSpectralMaterialVariants} from './spectral-variants.mts';
import {prepareLayeredLeafLayouts} from './leaf-layouts.mts';
import {prepareLayeredOblatePresentation} from './presentation.mts';
import {withFocusedCamera} from '../focused-camera.mts';


const json=async (path:string):Promise<unknown>=>JSON.parse(await readFile(path,'utf8'));
const writeJson=(path:string,value:unknown)=>writeFile(path,JSON.stringify(value)+'\n');

export const isLayeredOblateRecipe=(value:unknown)=>isRecord(value)&&value.schema==='cssearth-layered-oblate-preparation@1';

/** A full source-to-consumer pipeline; no runtime product is a preparation input. */
export async function prepareLayeredOblateObject({objectDirectory,publicDirectory,outputDirectory,write=false,prepareContent}: {objectDirectory:string;publicDirectory:string;outputDirectory:string;write?:boolean;prepareContent:typeof prepareObjectContentAssets}) {
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
  const contentSource=shape({displayName:text,lenses:shape({controls:array(shape({id:text}))})})(required('content'));
  if(!isLayeredOblateRecipe(geometry)||[geometry,surface,materials,radialMotion,presentationConfig].some(config=>config.namespace!==descriptor.id))throw new TypeError('Authored capability identity differs.');
  if(descriptor.recipe.shape.kind!=='ellipsoid')throw new TypeError('Layered oblate preparation requires an ellipsoid.');
  if(descriptor.recipe.shape.radiusKm!==geometry.parameters.objectEquatorialRadiusKm||descriptor.recipe.shape.polarRadiusKm!==geometry.parameters.objectPolarRadiusKm)throw new TypeError('Authored ellipsoid shape differs from pinned preparation facts.');
  if(descriptor.recipe.shape.kind!=='ellipsoid'||!descriptor.recipe.rings||!descriptor.recipe.cutaway)throw new TypeError('Layered oblate preparation requires declared ellipsoid, radial layer, and cutaway capabilities.');
  const declared=descriptor.recipe.surfaces.flatMap(surface=>surface.lenses.map(lens=>lens.id));
  if(JSON.stringify(declared)!==JSON.stringify(contentSource.lenses.controls.map(lens=>lens.id)))throw new TypeError('Authored lenses differ from content controls.');
  const sourceDirectory=resolve(objectRoot,'source');
  const sourceManifest=await createSourceManifest({planetId:descriptor.id,planetName:contentSource.displayName,sourceRoot:sourceDirectory});await sourceManifest.verify();
  await Promise.all([mkdir(publicDirectory,{recursive:true}),mkdir(outputDirectory,{recursive:true})]);
  const stagingDirectory=resolve(outputDirectory,'.material-masters');
  const context={sourceDirectory,publicDirectory,stagingDirectory};
  await prepareGiantLayers({...context,config:rings,write:true});
  const radial=await prepareRadialMotionAndShadow({...context,config:radialMotion,radialRecipe:rings});
  const baseCompiler=await createLayeredOblatePreparation({...context,config:geometry,preparedInputs:radial});
  const metadata=await baseCompiler.prepareBaseMaterialSurfaces();
  const materialLenses=await prepareSpectralMaterialVariants({...context,config:surface});
  const views=await prepareCutawayMaterials({...context,config:materials,objectLightDirection:radial.ringSource.shadowModel.objectLightDirection});
  const compiler=await createLayeredOblatePreparation({...context,config:geometry,preparedInputs:{...radial,lenses:materialLenses,views}});
  const material=await compiler.composeMaterialSurfaces(metadata);
  const {runtimeScene:scene}=await compiler.prepareLayeredScene(material);
  const sky=preparePlanetCubicSky({objectId:descriptor.id,cameraContract:CUBIC_SKY_CAMERA_PRESENTATION_STANDARD});
  const sun=preparePlanetDirectionalSun();
  const contentResult=await prepareContent({sourceDirectory,publicDirectory,outputDirectory,config:{contentPath:relative(sourceDirectory,requiredSource('content').path)}});
  const {controls,content}=contentResult;
  const projectRoot=resolve(objectRoot,'../../..'),stylesheetPath=resolve(projectRoot,presentationConfig.stylesheet.path);
  if(relative(projectRoot,stylesheetPath).startsWith('..'))throw new TypeError('Layered stylesheet escapes project.');
  const stylesheet=await readFile(stylesheetPath,'utf8');
  const layouts=prepareLayeredLeafLayouts({scene,stylesheet,config:presentationConfig});
  const raw=await prepareLayeredOblatePresentation({publicDirectory,config:presentationConfig,plan:scene,layouts,lenses:materialLenses,views,sky,sun});
  const normalizedPresentation={...raw,materials:prepareMaterialTracks(raw),variants:raw.variants.map(variant=>({...variant,materials:variant.materials.map(material=>({...material,mode:material.mode==='default-pose'?'frames':material.mode}))}))};
  const presentation=withFocusedCamera(normalizedPresentation,sky);
  requirePreparedPresentation(presentation,{controls});
  const definition={...presentation,schema:'cssearth-object-runtime@4',id:descriptor.id,controls};
  // Only consumer-used scene data is published. Dormant moon/orbit generators,
  // raw masters and diagnostic shader metadata are not runtime dependencies.
  const values={scene,sky,sun,runtime:definition,'material-lenses':materialLenses,views,layouts};
  for(const[name,value]of Object.entries(values))await writeJson(resolve(outputDirectory,`${name}.json`),value);
  await prepareLayeredConsumerManifest({id:descriptor.id,definition,content,stylesheet,publicDirectory,objectDirectory:write?objectRoot:outputDirectory});
  const payload=JSON.stringify({schema:'cssearth-prepared-object@1',id:descriptor.id,type:descriptor.type,format:PREPARED_CSS_OBJECT_FORMAT,data:definition});
  await writeFile(resolve(outputDirectory,'object.json'),payload);
  if(write) {
    await writeFile(descriptorPath,JSON.stringify({...rawDescriptor,prepared:{format:PREPARED_CSS_OBJECT_FORMAT,url:'prepared/object.json',sha256:sha256(payload)}},null,2)+'\n');
  }
  await writeJson(resolve(outputDirectory,'authored-preparation.json'),{schema:'cssearth-authored-preparation@1',id:descriptor.id,sources:[...sources.values()].map(source=>source.reference),lanes:{radial:true,materials:true,geometry:true,content:true,celestial:true,presentation:true}});
  return {descriptor,sources,raster:surface,celestial:{sky,sun},scene,definition,content};
}

/** Preparation may retain intermediate density banks; deployed closure is exact. */
export function prepareLayeredConsumerManifest({id,definition,content,stylesheet,publicDirectory,objectDirectory}: {id:string;definition:unknown;content:unknown;stylesheet:string;publicDirectory:string;objectDirectory:string}) {
  const urls=collectUrls(id,[definition,content,stylesheet]);
  return inventoryPublicAssets({planetId:id,objectDirectory,urls,publicRoot:publicDirectory,allowPreparationArtifacts:true});
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
