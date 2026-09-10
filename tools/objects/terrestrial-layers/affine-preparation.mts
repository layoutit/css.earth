import type {createSourceManifest} from '../../../src/platform/source-manifest.mts';
import type {prepareObjectContentAssets} from '../content/prepare.ts';
import {requireObjectControls} from '../../../site/scene-contract.mts';
import {parseAffineProfile} from './affine-source.mts';
import {parseEllipsoidProfile} from './ellipsoid-geometry.mts';
import {readJsonSource} from '../../source-values.mts';
import {readFile,writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {createEllipsoidGeometry} from './ellipsoid-geometry.mts';
import {preparePhotographicAtmosphere} from './photographic-atmosphere.mts';
import {prepareReferenceCelestial} from './reference-celestial.mts';
import {prepareAffineSurface} from './affine-surface.mts';
import {prepareAffineLenses} from './affine-lenses.mts';
import {prepareAffineCamera} from './affine-camera.mts';
import {prepareRowMaterial} from './row-material.mts';
import {prepareAffinePresentation} from './affine-presentation.mts';

export async function prepareAffineLayers(context: {config:unknown;source:Awaited<ReturnType<typeof createSourceManifest>>;sourceDirectory:string;publicDirectory:string;outputDirectory:string;prepareContent:typeof prepareObjectContentAssets}) {
 const {source:sourceManifest,sourceDirectory,publicDirectory,outputDirectory,prepareContent}=context;
 const config=parseAffineProfile(context.config);
 const read=(p:string)=>readJsonSource(resolve(sourceDirectory,p));
 const shape=parseEllipsoidProfile(await read(config.shapePath)),profile=await read(config.atmospherePath),geometry={...shape,...createEllipsoidGeometry(shape)};
 const args={...context,config,sourceManifest,shape};
 const celestial=await prepareReferenceCelestial(args);
 const scene=await prepareAffineSurface({...args,sky:celestial.sky});
 const lenses=await prepareAffineLenses(args);
 const atmosphere=await preparePhotographicAtmosphere({sourceDirectory,profile,geometry});
 const lighting=await prepareRowMaterial({...args,atmosphere,sun:celestial.sun});
 const camera=await prepareAffineCamera({...args,geometry,scene,lighting,contract:celestial.contract});
 const scenePlan={...scene,camera};
 await writeFile(resolve(outputDirectory,'scene.json'),JSON.stringify(scenePlan)+'\n');
 const assets={surfaces:Object.fromEntries(lenses.controls.map(l=>[l.id,{url:l.surfaceUrl,url2x:l.surface2xUrl,polesUrl:l.polesUrl,polesUrl2x:l.poles2xUrl}]))};
 await writeFile(resolve(outputDirectory,'assets.json'),JSON.stringify(assets)+'\n');
 const content=await prepareContent({...args,config:{contentPath:'content/object.json'}});
 // Scientific lens plans stay separate from the shared shell's lenses.json.
 await writeFile(resolve(outputDirectory,'surface-lenses.json'),JSON.stringify(lenses)+'\n');
 const definition=await prepareAffinePresentation({...args,scene,camera,lighting,lenses,sun:celestial.sun,controls:requireObjectControls(content.controls,config.namespace)});
 await writeFile(resolve(outputDirectory,'runtime.json'),JSON.stringify(definition)+'\n');
 return {raster:{assets,lenses,lighting},celestial,scene:scenePlan,definition,content};
}
