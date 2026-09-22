import {parseEarthScene,parseEarthLenses,parseEarthPlaces,parseEarthTitle,parseEarthPanel} from './prepared-schema.mts';
import {validatePreparedCubicSky} from '../../../../src/platform/cubic-sky-contract.mts';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { validateDirectionalSunPlan } from '../../../../src/platform/directional-sun-contract.mts';
import { requirePreparedData } from '../../../../src/platform/prepared-presentation-contract.mts';
import { createSourceManifest } from '../../../../src/platform/source-manifest.mts';
import { createObjectRuntime, parsePreparedObjectRuntime, preparedObjectCapabilities, requireControls } from '../../../../src/renderers/css/dist/index.js';
import { createAtmospherePreparation } from '../../../../tools/objects/paged-ellipsoid/atmosphere.mts';
import { parsePagedProfile } from '../../../../tools/objects/paged-ellipsoid/profile-source.mts';
import type { SurfaceBankLenses, SurfaceBankPlan } from '../../../../tools/objects/paged-ellipsoid/contracts.mts';
import { createPagedSurfaceRaster } from '../../../../tools/objects/paged-ellipsoid/surface-raster.mts';
import { surfaceBankInventory, requireSurfacePages } from '../../../../tools/objects/paged-ellipsoid/surface-banks.mts';
import { requireRecord, requireString } from '../../../../tools/sources/source-values.mts';

type JsonRecord = Record<string, unknown>;

const sourceDirectory = fileURLToPath(new URL('../../../../src/objects/earth/source/', import.meta.url));

async function read(path: string): Promise<JsonRecord> {
  const value: unknown = JSON.parse(await readFile(new URL(`../../../../src/objects/earth/${path}`, import.meta.url), 'utf8'));
  requirePreparedData(value, `Earth fixture ${path}`);
  return requireRecord(value, `Earth fixture ${path}`);
}

function readSurfaceBankPlan(value: unknown): SurfaceBankPlan {
  const scene = requireRecord(value, 'Earth prepared scene');
  const body = requireRecord(scene.body, 'Earth prepared scene body');
  const assets = requireRecord(body.assets, 'Earth prepared scene body assets');
  const surface = requireRecord(assets.surface, 'Earth prepared scene surface');
  const interior = requireRecord(scene.interior, 'Earth prepared scene interior');
  const outerAssets = requireRecord(interior.outerAssets, 'Earth prepared scene outer assets');
  const outerSurface = requireRecord(outerAssets.surface, 'Earth prepared scene outer surface');
  const litSurface = requireRecord(outerAssets.litSurface, 'Earth prepared scene lit outer surface');
  const urls = (input: unknown, label: string): readonly string[] => {
    if (!Array.isArray(input)) throw new TypeError(`${label} must be an array.`);
    return input.map((entry, index) => requireString(entry, `${label} ${index}`));
  };
  return {
    body: { assets: { surface: { url: requireString(surface.url, 'Earth prepared scene surface URL'), urls: urls(surface.urls, 'Earth prepared scene surface URLs') } } },
    interior: { outerAssets: { surface: {
      one: requireString(outerSurface.one, 'Earth prepared scene outer surface one'),
      two: requireString(outerSurface.two, 'Earth prepared scene outer surface two'),
      oneUrls: urls(outerSurface.oneUrls, 'Earth prepared scene outer surface one URLs'),
      twoUrls: urls(outerSurface.twoUrls, 'Earth prepared scene outer surface two URLs'),
    }, litSurface: { urls: urls(litSurface.urls, 'Earth prepared scene lit outer surface URLs') } } },
  };
}

function readSurfaceBankLenses(value: unknown): SurfaceBankLenses {
  const source = requireRecord(value, 'Earth prepared lenses');
  if (!Array.isArray(source.controls)) throw new TypeError('Earth prepared lenses require controls.');
  return {
    defaultLens: requireString(source.defaultLens, 'Earth prepared default lens'),
    controls: source.controls.map((value, index) => {
      const lens = requireRecord(value, `Earth prepared lens ${index}`);
      const optionalString = (field: string): string | undefined => lens[field] === undefined ? undefined : requireString(lens[field], `Earth prepared lens ${index} ${field}`);
      const surfaceUrls = lens.surfaceUrls === undefined ? undefined : (() => {
        if (!Array.isArray(lens.surfaceUrls)) throw new TypeError(`Earth prepared lens ${index} surface URLs must be an array.`);
        return lens.surfaceUrls.map((url, urlIndex) => requireString(url, `Earth prepared lens ${index} surface URL ${urlIndex}`));
      })();
      return { id: requireString(lens.id, `Earth prepared lens ${index} id`), ...optionalString('surfaceBankId') === undefined ? {} : { surfaceBankId: optionalString('surfaceBankId') },
        ...optionalString('view') === undefined ? {} : { view: optionalString('view') },
        ...surfaceUrls === undefined ? {} : { surfaceUrls },
        ...optionalString('surfaceUrl') === undefined ? {} : { surfaceUrl: optionalString('surfaceUrl') } };
    }),
  };
}

export const runtimeDefinition = parsePreparedObjectRuntime(await read('prepared/runtime.json'));
function checkedControls(value: unknown) {
  requireControls(value);
  return value;
}
export const objectControls = checkedControls(await read('prepared/controls.json'));
export const PREPARED_EARTH_SCENE = parseEarthScene(await read('prepared/scene.json'));
export const PREPARED_EARTH_LENSES = parseEarthLenses(await read('prepared/lenses.json'));
export const PREPARED_EARTH_SKY_SUN = validateDirectionalSunPlan(await read('prepared/sun.json'));
export const PREPARED_EARTH_STARFIELD = validatePreparedCubicSky(await read('prepared/sky.json'));
export const PREPARED_EARTH_PLACES = parseEarthPlaces(await read('prepared/places.json'));
const preparedContent = await read('prepared/content.json');
const sourceContent = await read('source/content/object.json');
export const PREPARED_EARTH_TITLE = parseEarthTitle(preparedContent.title);
export const PREPARED_EARTH_PANEL = parseEarthPanel(sourceContent.panel);
export const earthPreparationConfig = parsePagedProfile(await read('source/preparation/paged-ellipsoid.json'));
const config=earthPreparationConfig;
const source = await createSourceManifest({ planetId: 'earth', planetName: 'Earth', sourceRoot: sourceDirectory });
export const earthSourceManifest = () => source.manifest;
export const verifyEarthSourceManifest = source.verify;
const atmosphere = createAtmospherePreparation({ config, sourceDirectory, sourceManifest: source.manifest, sun: PREPARED_EARTH_SKY_SUN });
export const readEarthAtmosphereModel = atmosphere.readAtmosphereModel;
export const earthAtmosphereProfile = atmosphere.atmosphereProfile;
export const EARTH_MATERIAL_TILE_SIZE = atmosphere.MATERIAL_TILE_SIZE;
export const EARTH_MATERIAL_FRAMES_PER_SHARD = atmosphere.MATERIAL_FRAMES_PER_SHARD;
const raster = createPagedSurfaceRaster(config);
export const bakeSurfaceRaster = raster.bakeSurfaceRaster;
export const prepareSurfaceRasterCells = raster.createSurfaceRasterPlan;
export const surfacePageUrls = raster.surfacePageUrls;
export const EARTH_SURFACE_ATLAS = raster.atlas;
export const bakeEarthSurfaceRaster = raster.bakeSurfaceRaster;
export const createEarthSurfaceRasterPlan = raster.createSurfaceRasterPlan;
export const earthSurfaceBankInventory = (plan = PREPARED_EARTH_SCENE, lenses = PREPARED_EARTH_LENSES) => surfaceBankInventory(readSurfaceBankPlan(plan), readSurfaceBankLenses(lenses), '/scenes/earth/');
export const requireEarthSurfacePages = (urls: readonly string[], label: string) => requireSurfacePages(urls, label, '/scenes/earth/');
export const mountEarthClient = (stage: HTMLElement, options: Parameters<ReturnType<typeof createObjectRuntime>>[1]) => createObjectRuntime(runtimeDefinition)(stage, { ...options, capabilities: preparedObjectCapabilities });
