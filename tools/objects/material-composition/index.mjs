import {createHash} from 'node:crypto';
import {mkdir,readFile,realpath,writeFile} from 'node:fs/promises';
import {relative,resolve,sep} from 'node:path';
import {pathToFileURL} from 'node:url';
import sharp from 'sharp';
import {parseAuthoredObjectDescriptor} from '@cssearth/objects';
import {verifySourceManifest} from '../../../src/platform/source-manifest.mjs';
import {prepareRuntimeAssetManifest} from '../../../src/platform/runtime-asset-closure.mjs';
import {requirePreparedPresentation} from '../../../src/platform/prepared-presentation-contract.mjs';
import {CUBIC_SKY_CAMERA_PRESENTATION_STANDARD,CUBIC_SKY_POINT_SOURCE_PRESENTATION_STANDARD} from '../../../src/platform/cubic-sky-contract.mjs';
import {preparePlanetCubicSky} from '../../../src/platform/prepare-cubic-sky-source.mjs';
import {preparePlanetDirectionalSun} from '../../../src/platform/prepare-directional-sun.mjs';
import {prepareMaterialTracks} from '../../prepare-materials.mjs';
import {prepareGiantLayers} from '../giant-layers/index.mjs';
import {prepareCutawayMaterials} from '../cutaway/materials.mjs';
import {createLayeredOblatePreparation} from './layered-oblate.mjs';
import {prepareRadialMotionAndShadow} from './radial-motion.mjs';
import {prepareSpectralMaterialVariants} from './spectral-variants.mjs';
import {prepareLayeredLeafLayouts} from './leaf-layouts.mjs';
import {prepareLayeredOblatePresentation} from './presentation.mjs';

const hash=bytes=>createHash('sha256').update(bytes).digest('hex');
const json=async path=>JSON.parse(await readFile(path,'utf8'));
const writeJson=(path,value)=>writeFile(path,JSON.stringify(value)+'\n');

export const isLayeredOblateRecipe=value=>value?.schema==='cssearth-layered-oblate-preparation@1';

/** A full source-to-consumer pipeline; no runtime product is a preparation input. */
export async function prepareLayeredOblateObject({objectDirectory,publicDirectory,outputDirectory,write=false,prepareContent}) {
  if(typeof prepareContent!=='function')throw new TypeError('Layered preparation requires the shared content compiler.');
  // Each phase can atomically replace a decoded image at the same path. The
  // previous separate-process pipeline never reused cached file-loader nodes.
  sharp.cache(false);
  const objectRoot=await realpath(objectDirectory),descriptorPath=resolve(objectRoot,'object.json');
  const rawDescriptor=await json(descriptorPath),descriptor=parseAuthoredObjectDescriptor(rawDescriptor),sources=new Map();
  if(!write&&resolve(publicDirectory)===resolve(objectRoot,'../../../public/scenes',descriptor.id))throw new Error('Read-only source comparison cannot target canonical public assets.');
  for(const reference of descriptor.recipe.sources) {
    const path=await realpath(resolve(objectRoot,reference.path)),offset=relative(objectRoot,path);
    if(offset==='..'||offset.startsWith(`..${sep}`)||offset.startsWith(sep))throw new TypeError('Authored source escapes object directory.');
    const bytes=await readFile(path);
    if(hash(bytes)!==reference.sha256)throw new Error(`Authored source pin changed: ${reference.path}`);
    sources.set(reference.id,{reference,path,value:JSON.parse(bytes.toString('utf8'))});
  }
  const required=id=>{const source=sources.get(id);if(!source)throw new TypeError(`Layered preparation requires ${id}.`);return source.value;};
  const geometry=required('geometry'),surface=required('surface'),materials=required('materials'),radialMotion=required('radial-motion'),rings=required('rings'),presentationConfig=required('presentation'),celestial=required('celestial');
  if(!isLayeredOblateRecipe(geometry)||[geometry,surface,materials,radialMotion,presentationConfig].some(config=>config.namespace!==descriptor.id)||celestial.id!==descriptor.id)throw new TypeError('Authored capability identity differs.');
  if(descriptor.recipe.shape.radiusKm!==geometry.parameters.objectEquatorialRadiusKm||descriptor.recipe.shape.polarRadiusKm!==geometry.parameters.objectPolarRadiusKm)throw new TypeError('Authored ellipsoid shape differs from pinned preparation facts.');
  if(descriptor.recipe.shape.kind!=='ellipsoid'||!descriptor.recipe.rings||!descriptor.recipe.cutaway)throw new TypeError('Layered oblate preparation requires declared ellipsoid, radial layer, and cutaway capabilities.');
  const declared=descriptor.recipe.surfaces.flatMap(surface=>surface.lenses.map(lens=>lens.id));
  if(JSON.stringify(declared)!==JSON.stringify(required('content').lenses.controls.map(lens=>lens.id)))throw new TypeError('Authored lenses differ from content controls.');
  const sourceDirectory=resolve(objectRoot,'source');
  await verifySourceManifest({manifest:await json(resolve(sourceDirectory,'manifest.json')),sourceRoot:sourceDirectory,planetName:required('content').displayName});
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
  const ensureDirectories=()=>mkdir(publicDirectory,{recursive:true});
  const sky=await preparePlanetCubicSky({objectId:descriptor.id,sourceRoot:sourceDirectory,publicRoot:publicDirectory,ensureDirectories,validateSourceGroup:async()=>undefined,includeSun:celestial.includeSun,cameraContract:CUBIC_SKY_CAMERA_PRESENTATION_STANDARD,pointSourceContract:CUBIC_SKY_POINT_SOURCE_PRESENTATION_STANDARD,writeModule:false});
  const sun=await preparePlanetDirectionalSun({objectId:descriptor.id,publicRoot:publicDirectory,ensureDirectories,...celestial.directionalSun,writeModule:false});
  const contentResult=await prepareContent({sourceDirectory,publicDirectory,outputDirectory,config:{contentPath:relative(sourceDirectory,sources.get('content').path)}});
  const {controls,content}=contentResult;
  const projectRoot=resolve(objectRoot,'../../..'),stylesheetPath=resolve(projectRoot,presentationConfig.stylesheet.path);
  if(relative(projectRoot,stylesheetPath).startsWith('..'))throw new TypeError('Layered stylesheet escapes project.');
  const stylesheet=await readFile(stylesheetPath,'utf8');
  const layouts=prepareLayeredLeafLayouts({scene,stylesheet,config:presentationConfig});
  const raw=await prepareLayeredOblatePresentation({publicDirectory,config:presentationConfig,plan:scene,layouts,lenses:materialLenses,views,sky,sun});
  const presentation={...raw,materials:prepareMaterialTracks(raw),variants:raw.variants.map(variant=>({...variant,materials:variant.materials.map(material=>({...material,mode:material.mode==='default-pose'?'frames':material.mode}))}))};
  requirePreparedPresentation(presentation,{controls});
  const definition={...presentation,schema:'cssearth-object-runtime@4',id:descriptor.id,controls};
  // Only consumer-used scene data is published. Dormant moon/orbit generators,
  // raw masters and diagnostic shader metadata are not runtime dependencies.
  const values={scene,sky,sun,runtime:definition,'material-lenses':materialLenses,views,layouts};
  for(const[name,value]of Object.entries(values))await writeJson(resolve(outputDirectory,`${name}.json`),value);
  const manifest=await prepareLayeredConsumerManifest({id:descriptor.id,definition,content,stylesheet,publicDirectory,manifestPath:resolve(outputDirectory,'runtime-assets.json')});
  const payload=JSON.stringify({schema:'cssearth-prepared-object@1',id:descriptor.id,type:descriptor.type,format:'cssearth-css-object@4',data:definition});
  await writeFile(resolve(outputDirectory,'object.json'),payload);
  if(write) {
    await writeFile(descriptorPath,JSON.stringify({...rawDescriptor,prepared:{format:'cssearth-css-object@4',url:'prepared/object.json',sha256:hash(payload)}},null,2)+'\n');
    await writeFile(resolve(objectRoot,'runtime-assets.json'),JSON.stringify(manifest,null,2)+'\n');
  }
  await writeJson(resolve(outputDirectory,'authored-preparation.json'),{schema:'cssearth-authored-preparation@1',id:descriptor.id,sources:[...sources.values()].map(source=>source.reference),lanes:{radial:true,materials:true,geometry:true,content:true,celestial:true,presentation:true}});
  return {descriptor,sources,raster:surface,celestial:{sky,sun},scene,definition,content};
}

/** Preparation may retain intermediate density banks; deployed closure is exact. */
export function prepareLayeredConsumerManifest({id,definition,content,stylesheet,publicDirectory,manifestPath}) {
  const urls=collectUrls(id,[definition,definition.controls,content,stylesheet]);
  return prepareRuntimeAssetManifest({planetId:id,urls,publicRoot:publicDirectory,manifestPath:pathToFileURL(manifestPath),allowPreparationArtifacts:true});
}

function collectUrls(id,values) {
  const prefix=`/scenes/${id}/`,urls=new Set();
  const visit=value=>{
    if(typeof value==='string') {
      if(value.startsWith(prefix)&&!/[\s;()"']/.test(value))urls.add(value);
      for(const match of value.matchAll(/url\(\s*["']?(\/scenes\/[^\s)"']+)["']?\s*\)/gu))if(match[1].startsWith(prefix))urls.add(match[1]);
    }else if(Array.isArray(value))value.forEach(visit);else if(value&&typeof value==='object')Object.values(value).forEach(visit);
  };
  visit(values);return[...urls].sort();
}
