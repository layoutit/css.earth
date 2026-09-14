import {requireObjectControls} from '../../../site/scene-contract.mts';
import type {AuthoredObjectDescriptor} from '@cssearth/objects';
import type {prepareObjectContentAssets} from '../content/prepare.ts';
import {readJsonSource, requireFiniteNumber} from '../../source-values.mts';
import {validateSourceManifest} from '../../../src/platform/source-manifest.mts';
import {parsePagedProfile, parsePagedLensBindings, isPagedEllipsoidRecipe} from './profile-source.mts';
import {parseInteriorSource} from './source-contract.mts';
import {parseCitySource, parseBodyAttitude} from '../geographic-pages/source-records.mts';
export {isPagedEllipsoidRecipe} from './profile-source.mts';
export interface PagedEllipsoidContext {
  objectDirectory: string; publicDirectory: string; outputDirectory: string; packDirectory?: string;
  prepareContent: typeof prepareObjectContentAssets;
}
import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { relative, resolve } from 'node:path';
import { parseAuthoredObjectDescriptor } from '@cssearth/objects';
import { verifySourceManifest } from '../../../src/platform/source-manifest.mts';
import { preparePlanetCubicSky } from '../../../src/platform/prepare-cubic-sky-source.mts';
import { preparePlanetDirectionalSun } from '../../../src/platform/prepare-directional-sun.mts';
import { CUBIC_SKY_CAMERA_PRESENTATION_STANDARD } from '../../../src/platform/cubic-sky-contract.mts';
import { createAtmospherePreparation } from './atmosphere.mts';
import { createPagedSurfaceRaster } from './surface-raster.mts';
import { preparePagedEllipsoidScene } from './scene.mts';
import { preparePagedEllipsoidAssets } from './assets.mts';
import { preparePagedEllipsoidPresentation } from './presentation.mts';
import { prepareLocationPoint, prepareLocationCamera } from '../geographic-pages/prepare-location.mts';
import { prepareVectorOverlay } from '../geographic-pages/vector-overlay.mts';
import { preparePlaces } from '../geographic-pages/places.mts';
import { preparePinnedGlobalWmts } from '../geographic-pages/pinned-hierarchy.mts';
import { withFocusedCamera } from '../focused-camera.mts';

import { prepareTextureLevels } from './texture-levels.mts';

const json = readJsonSource;
const write = (directory: string, name: string, value: unknown) => writeFile(resolve(directory, `${name}.json`), `${JSON.stringify(value)}\n`);


/** Source-derived projective globe, atmosphere, cutaway, map hierarchy and places. */
export async function preparePagedEllipsoidObject({ objectDirectory, publicDirectory, outputDirectory, prepareContent, packDirectory = process.env.CSSEARTH_WMTS_PACK_DIRECTORY ?? resolve(process.cwd(), '.local/wmts-global') }: PagedEllipsoidContext) {
  const descriptor = parseAuthoredObjectDescriptor(await json(resolve(objectDirectory, 'object.json'))), sources = new Map<string, {reference: AuthoredObjectDescriptor['recipe']['sources'][number]; path: string; value: unknown}>();
  for (const reference of descriptor.recipe.sources) {
    const path = resolve(objectDirectory, reference.path), offset = relative(objectDirectory, path);
    if (offset.startsWith('..')) throw new TypeError('Source escapes its object directory.');
    const bytes = await readFile(path);
    if (createHash('sha256').update(bytes).digest('hex') !== reference.sha256) throw new TypeError(`Source digest differs: ${reference.path}`);
    sources.set(reference.id, { reference, path, value: JSON.parse(bytes.toString('utf8')) });
  }
  const required = (id: string) => { const source = sources.get(id); if (!source) throw new TypeError(`Paged ellipsoid requires ${id}.`); return source.value; };
  const config = parsePagedProfile(required('paged-ellipsoid')), bindingSource = parsePagedLensBindings(required('lens-bindings'));
  if (!isPagedEllipsoidRecipe(config) || config.namespace !== descriptor.id || config.publicBase !== `/scenes/${descriptor.id}/`) throw new TypeError('Paged ellipsoid identity differs.');
  if (config.geometry.BODY_LATITUDE_SEGMENTS !== 16 || config.geometry.BODY_LONGITUDE_SEGMENTS !== 32) throw new TypeError('Unsupported segmented projective globe topology.');
  if (descriptor.recipe.shape.radiusKm !== config.equatorialRadiusKm || !descriptor.recipe.cutaway || !descriptor.recipe.atmosphere) throw new TypeError('Authored physical capabilities differ from their prepared operators.');
  const declared = descriptor.recipe.surfaces.flatMap(surface => surface.lenses.map(lens => lens.id));
  if (JSON.stringify(declared) !== JSON.stringify(bindingSource.controls.map(lens => lens.id))) throw new TypeError('Authored lenses differ from presentation bindings.');
  const sourceDirectory = resolve(objectDirectory, 'source'), sourceManifest = validateSourceManifest(config.namespace, await json(resolve(sourceDirectory, 'manifest.json')));
  await verifySourceManifest({ sourceRoot: sourceDirectory, manifest: sourceManifest, planetName: config.displayName });
  await Promise.all([mkdir(publicDirectory, { recursive: true }), mkdir(outputDirectory, { recursive: true })]);
  const sun = preparePlanetDirectionalSun();
  const sky = preparePlanetCubicSky({ objectId: descriptor.id, cameraContract: CUBIC_SKY_CAMERA_PRESENTATION_STANDARD });
  const atmosphere = createAtmospherePreparation({ config, sourceDirectory, sourceManifest, sun }), atmosphereModel = await atmosphere.readAtmosphereModel(), raster = createPagedSurfaceRaster(config);
  const paging = descriptor.recipe.paging, destinations = descriptor.recipe.destinations;
  if (Boolean(paging) !== Boolean(destinations)) throw new TypeError('Geographic paging and destinations must be declared together.');
  const citySource = paging ? parseCitySource(await json(resolve(sourceDirectory, config.cityPath))) : null;
  // The scene needs the declared retained pool capacity, not a previously prepared overlay.
  const interiorSource = parseInteriorSource(await json(resolve(sourceDirectory, config.interiorPath)));
  requireFiniteNumber(interiorSource[config.interiorRadiusKey], config.interiorRadiusKey);
  if (interiorSource.tomographyPath && sources.get('mantle-tomography')?.reference.path !== `source/${interiorSource.tomographyPath}`)
    throw new Error('Mantle tomography must bind its authored recipe for reproducible provenance.');
  const { scene, surfaceRasterPlan } = preparePagedEllipsoidScene({ config, interiorSource, citySource, noise: paging ? { poolSize: config.geographic.noise.poolSize } : null, atmosphereModel, atmosphere, raster });
  const rasterAssets = await preparePagedEllipsoidAssets({ config, sourceDirectory, publicDirectory, surfaceRasterPlan, atmosphere, atmosphereModel, raster });
  const context = { sourceDirectory, publicDirectory, config, scene };
  let noise: Awaited<ReturnType<typeof prepareVectorOverlay>> | undefined;
  let catalog: Awaited<ReturnType<typeof preparePlaces>> | undefined;
  let city: NonNullable<Awaited<ReturnType<typeof preparePinnedGlobalWmts>>['plan']> | undefined;
  let report: Awaited<ReturnType<typeof preparePinnedGlobalWmts>>['report'] | undefined;
  // Geographic preparation is an authored capability, not a requirement of a globe.
  if (paging) {
    if (!destinations) throw new TypeError('Geographic paging requires destinations.');
    noise = await prepareVectorOverlay(context);
    catalog = await preparePlaces(context);
    const geographic = await preparePinnedGlobalWmts({ sourceRoot: sourceDirectory, packDirectory, scene, namespace: descriptor.id, displayName: config.displayName, assetPath: config.publicBase, pages: config.geographic.pages });
    if (!geographic.plan) throw new TypeError('Geographic preparation did not produce a page plan.');
    city = geographic.plan; report = geographic.report;
    if (paging.surface !== 'body' || paging.maxResidentPages !== city.poolSize ||
        paging.maxResidentBytes !== city.maximumDecodedBytes || paging.maxConcurrentLoads !== city.maximumConcurrentLoads)
      throw new TypeError('Authored page residency differs from the prepared hierarchy.');
    if (catalog.count > destinations.maxEntries)
      throw new TypeError('Prepared places exceed the authored destination capability.');
  }
  const lenses = { ...bindingSource, controls: bindingSource.controls.map(({ surfacePagePrefix, cityZoom, overlayId, focus, ...lens }) => {
    if (cityZoom && !citySource) throw new TypeError(`City lens ${lens.id} requires a city source.`);
    if (overlayId === 'noise' && !noise) throw new TypeError(`Noise lens ${lens.id} requires its prepared overlay.`);
    return { ...lens,
    ...(surfacePagePrefix ? { surfaceUrls: raster.surfacePageUrls(surfacePagePrefix, surfaceRasterPlan.pages.length) } : {}),
    ...(focus ? { camera: { ...prepareLocationCamera(scene, prepareLocationPoint(scene, focus.longitude, focus.latitude), focus.zoom, { body: parseBodyAttitude(scene[config.sceneBodyKey]), camera: config.camera, northUp: focus.northUp }), ...(focus.transition ? { transition: focus.transition } : {}) } } : {}),
    ...(cityZoom && citySource ? { maximumZoom: citySource.presentation.maximumZoom } : {}),
    ...(overlayId === 'noise' && noise ? { camera: noise.camera, legend: noise.legend, qualification: noise.qualification } : {}),
  }; }) };
  const preparedContent = await prepareContent({ sourceDirectory, publicDirectory, outputDirectory, config: { contentPath: 'content/object.json' } });
  const content = { ...preparedContent.content, ...(catalog ? { destinations: { searchLabel: config.destinations.searchLabel, description: `${catalog.count.toLocaleString('en')}${config.destinations.descriptionSuffix}` } } : {}) };
  const textureLevels = await prepareTextureLevels({ config, plan: scene, lenses, publicDirectory });
  if (textureLevels) await write(outputDirectory, 'texture-levels', textureLevels);
  const controls = requireObjectControls(preparedContent.controls, descriptor.id);
  const rawDefinition = await preparePagedEllipsoidPresentation({ config, plan: scene, lenses, sky, sun, catalog, city, noise, textureLevels, controls });
  const definition = withFocusedCamera(rawDefinition, sky);
  for (const [name, value] of Object.entries({ scene, 'raster-assets': rasterAssets, 'surface-raster-plan': surfaceRasterPlan, sky, sun, ...(paging ? { noise, places: catalog, pages: city, 'page-preparation': report } : {}), lenses, content, runtime: definition })) await write(outputDirectory, name, value);
  await write(outputDirectory, 'authored-preparation', { schema: 'cssearth-authored-preparation@1', id: descriptor.id, sources: descriptor.recipe.sources, lanes: { raster: true, celestial: true, geometry: true, content: true, presentation: true, geographicPages: Boolean(paging) } });
  return { descriptor, sources, raster: rasterAssets, celestial: { sky, sun }, scene, definition, content };
}
