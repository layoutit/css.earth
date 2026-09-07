import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { basename, relative, resolve } from 'node:path';
import { parseAuthoredObjectDescriptor } from '@cssearth/objects';
import { verifySourceManifest } from '../../../src/platform/source-manifest.mjs';
import { preparePlanetCubicSky } from '../../../src/platform/prepare-cubic-sky-source.mjs';
import { preparePlanetDirectionalSun } from '../../../src/platform/prepare-directional-sun.mjs';
import { CUBIC_SKY_CAMERA_PRESENTATION_STANDARD, CUBIC_SKY_POINT_SOURCE_PRESENTATION_STANDARD } from '../../../src/platform/cubic-sky-contract.mjs';
import { createAtmospherePreparation } from './atmosphere.mjs';
import { createPagedSurfaceRaster } from './surface-raster.mjs';
import { preparePagedEllipsoidScene } from './scene.mjs';
import { preparePagedEllipsoidAssets } from './assets.mjs';
import { preparePagedEllipsoidPresentation } from './presentation.mjs';
import { prepareVectorOverlay } from '../geographic-pages/vector-overlay.mjs';
import { prepareLandCover } from '../geographic-pages/land-cover.mjs';
import { prepareGeographicInventory } from '../geographic-pages/inventory.mjs';
import { preparePlaces } from '../geographic-pages/places.mjs';
import { preparePinnedGlobalWmts } from '../geographic-pages/pinned-hierarchy.mjs';
import { prepareOpaquePolarDiscs } from '../geographic-pages/opaque-polar-discs.mjs';
import { canonicalPreparedAsset } from '../../../src/platform/prepared-object-assets.mjs';

const json = async path => JSON.parse(await readFile(path, 'utf8'));
const write = (directory, name, value) => writeFile(resolve(directory, `${name}.json`), `${JSON.stringify(value)}\n`);
export const isPagedEllipsoidRecipe = value => value?.schema === 'cssearth-paged-ellipsoid@1';

/** Source-derived projective globe, atmosphere, cutaway, map hierarchy and places. */
export async function preparePagedEllipsoidObject({ objectDirectory, publicDirectory, outputDirectory, prepareContent, packDirectory = process.env.CSSEARTH_WMTS_PACK_DIRECTORY ?? resolve(process.cwd(), '.local/wmts-global') }) {
  const descriptor = parseAuthoredObjectDescriptor(await json(resolve(objectDirectory, 'object.json'))), sources = new Map();
  for (const reference of descriptor.recipe.sources) {
    const path = resolve(objectDirectory, reference.path), offset = relative(objectDirectory, path);
    if (offset.startsWith('..')) throw new TypeError('Source escapes its object directory.');
    const bytes = await readFile(path);
    if (createHash('sha256').update(bytes).digest('hex') !== reference.sha256) throw new TypeError(`Source digest differs: ${reference.path}`);
    sources.set(reference.id, { reference, path, value: JSON.parse(bytes) });
  }
  const required = id => { const source = sources.get(id); if (!source) throw new TypeError(`Paged ellipsoid requires ${id}.`); return source.value; };
  const config = required('paged-ellipsoid'), celestialConfig = required('celestial'), bindingSource = required('lens-bindings');
  if (!isPagedEllipsoidRecipe(config) || config.namespace !== descriptor.id || config.publicBase !== `/scenes/${descriptor.id}/`) throw new TypeError('Paged ellipsoid identity differs.');
  if (config.geometry.BODY_LATITUDE_SEGMENTS !== 16 || config.geometry.BODY_LONGITUDE_SEGMENTS !== 32) throw new TypeError('Unsupported segmented projective globe topology.');
  if (descriptor.recipe.shape.radiusKm !== config.equatorialRadiusKm || !descriptor.recipe.cutaway || !descriptor.recipe.atmosphere) throw new TypeError('Authored physical capabilities differ from their prepared operators.');
  const declared = descriptor.recipe.surfaces.flatMap(surface => surface.lenses.map(lens => lens.id));
  if (JSON.stringify(declared) !== JSON.stringify(bindingSource.controls.map(lens => lens.id))) throw new TypeError('Authored lenses differ from presentation bindings.');
  const sourceDirectory = resolve(objectDirectory, 'source'), sourceManifest = await json(resolve(sourceDirectory, 'manifest.json'));
  await verifySourceManifest({ sourceRoot: sourceDirectory, manifest: sourceManifest, planetName: config.displayName });
  await Promise.all([mkdir(publicDirectory, { recursive: true }), mkdir(outputDirectory, { recursive: true })]);
  const ensureDirectories = () => mkdir(publicDirectory, { recursive: true });
  const sun = await preparePlanetDirectionalSun({ objectId: descriptor.id, publicRoot: publicDirectory, ensureDirectories, ...celestialConfig.directionalSun, writeModule: false });
  const sky = await preparePlanetCubicSky({ objectId: descriptor.id, sourceRoot: sourceDirectory, publicRoot: publicDirectory, ensureDirectories, validateSourceGroup: async () => undefined, includeSun: celestialConfig.includeSun, imageEncoding: celestialConfig.imageEncoding, cameraContract: CUBIC_SKY_CAMERA_PRESENTATION_STANDARD, pointSourceContract: CUBIC_SKY_POINT_SOURCE_PRESENTATION_STANDARD, writeModule: false });
  const atmosphere = createAtmospherePreparation({ config, sourceDirectory, sourceManifest, sun }), atmosphereModel = await atmosphere.readAtmosphereModel(), raster = createPagedSurfaceRaster(config);
  const citySource = await json(resolve(sourceDirectory, config.cityPath));
  // The scene needs the declared retained pool capacity, not a previously prepared overlay.
  const { scene, surfaceRasterPlan } = preparePagedEllipsoidScene({ config, interiorSource: await json(resolve(sourceDirectory, config.interiorPath)), citySource, noise: { poolSize: config.geographic.noise.poolSize }, atmosphereModel, atmosphere, raster });
  const rasterAssets = await preparePagedEllipsoidAssets({ config, sourceDirectory, publicDirectory, surfaceRasterPlan, atmosphere, atmosphereModel, raster });
  const { plan: city, report } = await preparePinnedGlobalWmts({ sourceRoot: sourceDirectory, packDirectory, scene, namespace: descriptor.id, displayName: config.displayName, assetPath: config.publicBase, pages: config.geographic.pages });
  const opaque=await prepareOpaquePolarDiscs(scene,await readFile(resolve(publicDirectory,basename(canonicalPreparedAsset(scene.body.assets.poles)))));
  city.opaqueDiscs=opaque.discs;report.opaqueDiscs=opaque.receipt;
  const preparedContent = await prepareContent({ sourceDirectory, publicDirectory, outputDirectory, config: { contentPath: 'content/object.json' } });
  const context = { sourceDirectory, publicDirectory, config, scene, geometry: city, surfaceRasterPlan, raster };
  const observationSource = await json(resolve(sourceDirectory, 'observations.json'));
  const operators = new Map([['vector-overlay', prepareVectorOverlay], ['worldcover-land-cover', prepareLandCover]]), observations = new Map();
  for (const entry of observationSource.datasets) {
    const prepare = operators.get(entry.operator);
    if (!prepare) throw new Error(`Unsupported observation preparation operator: ${entry.operator}`);
    const result = await prepare({ ...context, ownership: entry.scope });
    observations.set(entry.id, result);
    await write(outputDirectory, `observation-${entry.id}`, result);
  }
  const geographic = prepareGeographicInventory(observationSource, observations, config);
  const places = await preparePlaces({ ...context, inventory: geographic.inventory, defaultLens: preparedContent.controls.lenses.defaultLens });
  const catalog = places.catalog;
  const paging = descriptor.recipe.paging, destinations = descriptor.recipe.destinations;
  if (!paging || paging.surface !== 'body' || paging.maxResidentPages !== city.poolSize ||
      paging.maxResidentBytes !== city.maximumDecodedBytes || paging.maxConcurrentLoads !== city.maximumConcurrentLoads)
    throw new TypeError('Authored page residency differs from the prepared hierarchy.');
  if (!destinations || catalog.count > destinations.maxEntries)
    throw new TypeError('Prepared places exceed the authored destination capability.');
  const {lenses,definition,content}=await preparePagedEllipsoidBindings({config,scene,raster,citySource,bindingSource,sky,sun,catalog,city,geographic,preparedContent});
  for (const [name, value] of Object.entries({ scene, 'raster-assets': rasterAssets, 'surface-raster-plan': surfaceRasterPlan, sky, sun,
    'geographic-lenses': geographic, 'place-assets': places.assets, 'place-preparation': places.receipt,
    places: catalog, pages: city, 'page-preparation': report, lenses, content, runtime: definition })) await write(outputDirectory, name, value);
  await write(outputDirectory, 'authored-preparation', { schema: 'cssearth-authored-preparation@1', id: descriptor.id, sources: descriptor.recipe.sources, lanes: { raster: true, celestial: true, geometry: true, content: true, presentation: true, geographicPages: true } });
  return { descriptor, sources, raster: rasterAssets, celestial: { sky, sun }, scene, definition, content,
    geographicAssets: [...geographic.assets, ...places.assets] };
}

/** Rebind verified prepared inputs without repeating raster or geometry acquisition. */
export async function preparePagedEllipsoidBindings({config,scene,raster,citySource,bindingSource,sky,sun,catalog,city,geographic,preparedContent}) {
  const lenses = { ...bindingSource, controls: bindingSource.controls.map(({ surfacePagePrefix, cityZoom, ...lens }) => ({ ...lens,
    ...(surfacePagePrefix ? { surfaceUrls: raster.surfacePageUrls(surfacePagePrefix, scene.body.assets.surface.urls.length) } : {}),
    ...(cityZoom ? { maximumZoom: citySource.presentation.maximumZoom } : {}),
  })) };
  const definition = await preparePagedEllipsoidPresentation({ config, plan: scene, lenses, sky, sun, catalog, city, geographic, controls: preparedContent.controls });
  const content = { ...preparedContent.content, destinations: { searchLabel: config.destinations.searchLabel,
    description: `${catalog.count.toLocaleString('en')}${config.destinations.descriptionSuffix}`,
    lenses: definition.destinations.rootEntity.lenses, lensIds: definition.destinations.rootEntity.lensIds } };
  return {lenses,definition,content};
}
