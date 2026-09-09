import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { createSourceManifest } from '../../../../src/platform/source-manifest.mjs';
import { createAtmospherePreparation } from '../../../../tools/objects/paged-ellipsoid/atmosphere.mjs';
import { createPagedSurfaceRaster } from '../../../../tools/objects/paged-ellipsoid/surface-raster.mjs';
import { createObjectRuntime, preparedObjectCapabilities } from '../../../../src/renderers/css/dist/index.js';
import { surfaceBankInventory, requireSurfacePages } from '../../../../tools/objects/paged-ellipsoid/surface-banks.mjs';
export const earthSurfaceBankInventory=(plan=PREPARED_EARTH_SCENE,lenses=PREPARED_EARTH_LENSES)=>surfaceBankInventory(plan,lenses,'/scenes/earth/');
export const requireEarthSurfacePages=(urls,label)=>requireSurfacePages(urls,label,'/scenes/earth/');
const sourceDirectory=fileURLToPath(new URL('../../../../src/planets/earth/source/',import.meta.url));
const read=async path=>JSON.parse(await readFile(new URL('../../../../src/planets/earth/'+path,import.meta.url)));
export const runtimeDefinition=await read('prepared/runtime.json'),objectControls=await read('prepared/controls.json');
export const PREPARED_EARTH_SCENE=await read('prepared/scene.json'),PREPARED_EARTH_LENSES=await read('prepared/lenses.json');
export const PREPARED_EARTH_SKY_SUN=await read('prepared/sun.json'),PREPARED_EARTH_STARFIELD=await read('prepared/sky.json');
export const PREPARED_EARTH_NOISE=await read('prepared/noise.json'),PREPARED_EARTH_CITY_PAGES=await read('prepared/pages.json'),PREPARED_EARTH_PLACES=await read('prepared/places.json');
export const PREPARED_EARTH_TITLE=(await read('prepared/content.json')).title,PREPARED_EARTH_PANEL=(await read('source/content/object.json')).panel;
const config=await read('source/preparation/paged-ellipsoid.json');
const source=await createSourceManifest({planetId:'earth',planetName:'Earth',sourceRoot:sourceDirectory});
export const earthSourceManifest=()=>source.manifest,verifyEarthSourceManifest=source.verify;
const atmosphere=createAtmospherePreparation({config,sourceDirectory,sourceManifest:source.manifest,sun:PREPARED_EARTH_SKY_SUN});
export const readEarthAtmosphereModel=atmosphere.readAtmosphereModel,earthAtmosphereProfile=atmosphere.atmosphereProfile;
export const EARTH_MATERIAL_TILE_SIZE=atmosphere.MATERIAL_TILE_SIZE,EARTH_MATERIAL_FRAMES_PER_SHARD=atmosphere.MATERIAL_FRAMES_PER_SHARD;
const raster=createPagedSurfaceRaster(config);
export const bakeSurfaceRaster=raster.bakeSurfaceRaster,prepareSurfaceRasterCells=raster.prepareSurfaceRasterCells,surfacePageUrls=raster.surfacePageUrls;
export const EARTH_SURFACE_ATLAS=raster.atlas,bakeEarthSurfaceRaster=raster.bakeSurfaceRaster,createEarthSurfaceRasterPlan=raster.createSurfaceRasterPlan;
export const mountEarthClient=(stage,options={})=>createObjectRuntime(runtimeDefinition)(stage,{...options,capabilities:preparedObjectCapabilities});

// Diagnostic plan substitutions still use the real renderer and verified object
// envelope. Keep its descriptor hash synchronized instead of bypassing validation.
export async function preparePagingDiagnostic(plan) {
  const descriptor=await read('object.json'),prepared=await read('prepared/object.json');
  // Paging is an explicit diagnostic capability; the MVP Earth has no page pools.
  const nodes=prepared.data.tree.nodes;
  prepared.data.pageLayers=[{id:'city',plan:{...plan,schema:'cssearth-prepared-map-pages@1',assetPath:'/scenes/earth/'},
    lensIds:['normal'],carrier:nodes.findIndex(node=>node.className==='polycss-mesh earth-body'),
    system:nodes.findIndex(node=>node.className==='polycss-mesh earth-system'),
    className:'earth-city-page',textureClassName:'earth-api-texture'}];
  const preparedJson=JSON.stringify(prepared)+'\n';
  descriptor.prepared.sha256=createHash('sha256').update(preparedJson).digest('hex');
  return {preparedJson,descriptorJson:JSON.stringify(descriptor),descriptorModule:`export default ${JSON.stringify(descriptor)};`};
}
export async function routePagingDiagnostic(target,diagnostic) {
  await target.route(/\/src\/planets\/earth\/object\.json(?:\?.*)?$/,route=>route.fulfill({contentType:'text/javascript',body:diagnostic.descriptorModule}));
  await target.route(/\/src\/planets\/earth\/prepared\/object\.json$/,route=>route.fulfill({contentType:'application/json',body:diagnostic.preparedJson}));
}
