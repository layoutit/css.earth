import {readFile,writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {createEllipsoidGeometry} from './ellipsoid-geometry.mjs';
import {preparePhotographicAtmosphere} from './photographic-atmosphere.mjs';
import {prepareReferenceCelestial} from './reference-celestial.mjs';
import {prepareAffineSurface} from './affine-surface.mjs';
import {prepareAffineLenses} from './affine-lenses.mjs';
import {prepareAffineCamera} from './affine-camera.mjs';
import {prepareRowMaterial} from './row-material.mjs';
import {prepareAffinePresentation} from './affine-presentation.mjs';

export async function prepareAffineLayers(context) {
 const {config,source:sourceManifest,sourceDirectory,publicDirectory,outputDirectory,prepareContent}=context;
 const read=p=>readFile(resolve(sourceDirectory,p),'utf8').then(JSON.parse);
 const shape=await read(config.shapePath),profile=await read(config.atmospherePath),geometry={...shape,...createEllipsoidGeometry(shape)};
 const args={...context,sourceManifest,shape};
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
 const definition=await prepareAffinePresentation({...args,scene,camera,lighting,lenses,sun:celestial.sun,controls:content.controls});
 await writeFile(resolve(outputDirectory,'runtime.json'),JSON.stringify(definition)+'\n');
 return {raster:{assets,lenses,lighting},celestial,scene:scenePlan,definition,content};
}
