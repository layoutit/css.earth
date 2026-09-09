import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { relative, resolve } from 'node:path';
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
import { preparePlaces } from '../geographic-pages/places.mjs';
import { preparePinnedGlobalWmts } from '../geographic-pages/pinned-hierarchy.mjs';

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
  const sky = await preparePlanetCubicSky({ objectId: descriptor.id, sourceRoot: sourceDirectory, publicRoot: publicDirectory, ensureDirectories, validateSourceGroup: async () => undefined, includeSun: celestialConfig.includeSun, cameraContract: CUBIC_SKY_CAMERA_PRESENTATION_STANDARD, pointSourceContract: CUBIC_SKY_POINT_SOURCE_PRESENTATION_STANDARD, writeModule: false });
  const atmosphere = createAtmospherePreparation({ config, sourceDirectory, sourceManifest, sun }), atmosphereModel = await atmosphere.readAtmosphereModel(), raster = createPagedSurfaceRaster(config);
  const paging = descriptor.recipe.paging, destinations = descriptor.recipe.destinations;
  if (Boolean(paging) !== Boolean(destinations)) throw new TypeError('Geographic paging and destinations must be declared together.');
  const citySource = paging ? await json(resolve(sourceDirectory, config.cityPath)) : null;
  // The scene needs the declared retained pool capacity, not a previously prepared overlay.
  const { scene, surfaceRasterPlan } = preparePagedEllipsoidScene({ config, interiorSource: await json(resolve(sourceDirectory, config.interiorPath)), citySource, noise: paging ? { poolSize: config.geographic.noise.poolSize } : null, atmosphereModel, atmosphere, raster });
  const rasterAssets = await preparePagedEllipsoidAssets({ config, sourceDirectory, publicDirectory, surfaceRasterPlan, atmosphere, atmosphereModel, raster });
  const context = { sourceDirectory, publicDirectory, config, scene };
  let noise, catalog, city, report;
  // Geographic preparation is an authored capability, not a requirement of a globe.
  if (paging) {
    noise = await prepareVectorOverlay(context);
    catalog = await preparePlaces(context);
    ({ plan: city, report } = await preparePinnedGlobalWmts({ sourceRoot: sourceDirectory, packDirectory, scene, namespace: descriptor.id, displayName: config.displayName, assetPath: config.publicBase, pages: config.geographic.pages }));
    if (paging.surface !== 'body' || paging.maxResidentPages !== city.poolSize ||
        paging.maxResidentBytes !== city.maximumDecodedBytes || paging.maxConcurrentLoads !== city.maximumConcurrentLoads)
      throw new TypeError('Authored page residency differs from the prepared hierarchy.');
    if (catalog.count > destinations.maxEntries)
      throw new TypeError('Prepared places exceed the authored destination capability.');
  }
  const lenses = { ...bindingSource, controls: bindingSource.controls.map(({ surfacePagePrefix, cityZoom, overlayId, ...lens }) => ({ ...lens,
    ...(surfacePagePrefix ? { surfaceUrls: raster.surfacePageUrls(surfacePagePrefix, surfaceRasterPlan.pages.length) } : {}),
    ...(cityZoom ? { maximumZoom: citySource.presentation.maximumZoom } : {}),
    ...(overlayId === 'noise' ? { camera: noise.camera, legend: noise.legend, qualification: noise.qualification } : {}),
  })) };
  const preparedContent = await prepareContent({ sourceDirectory, publicDirectory, outputDirectory, config: { contentPath: 'content/object.json' } });
  const content = { ...preparedContent.content, ...(catalog ? { destinations: { searchLabel: config.destinations.searchLabel, description: `${catalog.count.toLocaleString('en')}${config.destinations.descriptionSuffix}` } } : {}) };
  const definition = await preparePagedEllipsoidPresentation({ config, plan: scene, lenses, sky, sun, catalog, city, noise, controls: preparedContent.controls });
  for (const [name, value] of Object.entries({ scene, 'raster-assets': rasterAssets, 'surface-raster-plan': surfaceRasterPlan, sky, sun, ...(paging ? { noise, places: catalog, pages: city, 'page-preparation': report } : {}), lenses, content, runtime: definition })) await write(outputDirectory, name, value);
  await write(outputDirectory, 'authored-preparation', { schema: 'cssearth-authored-preparation@1', id: descriptor.id, sources: descriptor.recipe.sources, lanes: { raster: true, celestial: true, geometry: true, content: true, presentation: true, geographicPages: Boolean(paging) } });
  return { descriptor, sources, raster: rasterAssets, celestial: { sky, sun }, scene, definition, content };
}
