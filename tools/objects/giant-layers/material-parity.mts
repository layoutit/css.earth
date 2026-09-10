import {parse} from '../material-composition/data-schema.mts';
import {runtimeAssetManifest} from './radial-contract.mts';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {resolve} from 'node:path';
import {prepareObservedSurfaces,verifyObservationSources} from './observations.mts';
import {prepareEllipsoidMaterials,parseEllipsoidMaterialRecipe} from './materials.mts';
import {parseRadialLayerRecipe,rasterAnnularField} from './index.mts';
const root=fileURLToPath(new URL('../../../',import.meta.url));
export async function assertMaterialPreparationParity(id: string){
  if(!/^[a-z][a-z0-9-]*$/u.test(id))throw new TypeError('Unsafe object identity.');
  const directory=resolve(root,'src/planets',id),sourceDirectory=resolve(directory,'source');
  const json=async(path: string):Promise<unknown>=>JSON.parse(await readFile(resolve(directory,path),'utf8'));
  const config=parseEllipsoidMaterialRecipe(await json('source/preparation/materials.json')),observations=await prepareObservedSurfaces({sourceDirectory,config:await json('source/preparation/observations.json')});
  let radialLayer;
  if(config.radialLayer){const recipe=parseRadialLayerRecipe(await json('source/preparation/rings.json'));await verifyObservationSources(sourceDirectory,recipe.sources);const layer=recipe.layers[config.radialLayer.layerIndex];if(layer?.kind!=='annular-field')throw new TypeError('Material radial input must be annular.');radialLayer={...config.radialLayer,data:rasterAnnularField(layer,config.radialLayer.size)};}
  const result=await prepareEllipsoidMaterials({config,maps:observations.maps,radialLayer,write:false});
  const accepted=parse(await json('runtime-assets.json'),runtimeAssetManifest,'runtime asset manifest');
  for(const {filename,bytes,sha256,data}of result.assets){const expected=accepted.assets.find(asset=>asset.filename===filename);assert.ok(expected,`Unaccepted material asset ${filename}`);assert.deepEqual({filename,bytes,sha256},expected,`${filename}: exact prepared identity`);assert.ok(data.equals(await readFile(resolve(root,'public/scenes',id,filename))),`${filename}: complete accepted encoded payload`);}
  return result;
}
