import { requireObjectControls } from '@cssearth/renderer/runtime/shell-contract.ts';
import type { ContentPreparationContext, PreparedObjectContentAssets } from '../../content/index.ts';
import { readJsonSource } from '../../sources/index.ts';
import { requireArray, requireRecord, requireString } from '@cssearth/core';
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { verifySourceManifest } from '@cssearth/objects/node';
import { withFocusedCamera } from '../../scene/index.ts';
import { prepareCubicSky } from '../../../presentation/index.ts';
import { CUBIC_SKY_CAMERA_PRESENTATION_STANDARD } from '../../../presentation/index.ts';
import type { preparePagedEllipsoidAssets } from './assets.ts';
import { readPagedEllipsoid } from './globe/context.ts';
import { parseBodyAttitude } from './geographic/source-records.ts';
import { preparePagedEllipsoidPresentation } from './presentation.ts';
import { prepareLocationPoint, prepareLocationCamera } from './geographic/prepare-location.ts';
import { preparePlaces } from './geographic/places.ts';
import type { SolarGeometry } from '../../scene/index.ts';

export interface PagedEllipsoidContext {
  objectDirectory: string; publicDirectory: string; outputDirectory: string; packDirectory?: string;
  prepareContent: (context: ContentPreparationContext) => Promise<PreparedObjectContentAssets>;
  /** The generated solar geometry (`src/platform/solar-geometry.mts`), loaded by the host. */
  solarGeometry: SolarGeometry;
  /** The host's module that runs one asset job in a worker thread (`packages/bake/cli/paged-ellipsoid-asset-worker.mts`): it
   * loads the solar geometry itself, so it is a command, not part of this library. */
  assetWorker: URL;
  /** Reuse this object's published raster, overlay, place, page and texture-level outputs from outputDirectory and publicDirectory,
   * and prepare only what the presentation derives from them. Refuses when the recipe sources or the recomputed plan differ. */
  reuseImages?: boolean;
  /** Recipe sources the author states changed without feeding the reused outputs; each is named in the run's output. */
  acceptChanged?: readonly string[];
}

import { keepTextureLevelBanks, keepTextureLevelWidths, prepareTextureLevels } from './texture-levels.ts';
import { surfaceBankInventory } from './surface-banks.ts';
import { preparePagedEllipsoidAssetsInParallel } from './parallel-assets.ts';

const json = readJsonSource;
// Published JSON may order keys differently from a fresh run; compare values, not serializations.
const canonical = (value: unknown): string => JSON.stringify(value, (_key, item: unknown) => item && typeof item === 'object' && !Array.isArray(item)
  ? Object.fromEntries(Object.entries(item).sort(([left], [right]) => left < right ? -1 : left > right ? 1 : 0)) : item);
const write = (directory: string, name: string, value: unknown) => writeFile(resolve(directory, `${name}.json`), `${JSON.stringify(value)}\n`);


/** Source-derived projective globe, atmosphere, cutaway, map hierarchy and places. */
export async function preparePagedEllipsoidObject({ objectDirectory, publicDirectory, outputDirectory, prepareContent, solarGeometry, assetWorker, reuseImages = false, acceptChanged = [], packDirectory = process.env.CSSEARTH_WMTS_PACK_DIRECTORY ?? resolve(process.cwd(), '.local/wmts-global') }: PagedEllipsoidContext) {
  const { descriptor, entries, sources, config, bindingSource, sourceDirectory, sourceManifest, sun, raster, scene, surfaceRasterPlan } = await readPagedEllipsoid(solarGeometry, objectDirectory);
  // The raw imagery is read only by the stages a reuse-images run reuses; it may be absent from this checkout.
  if (!reuseImages) await verifySourceManifest({ sourceRoot: sourceDirectory, manifest: sourceManifest, objectName: config.displayName });
  await Promise.all([mkdir(publicDirectory, { recursive: true }), mkdir(outputDirectory, { recursive: true })]);
  const published = async (name: string) => requireRecord(await json(resolve(outputDirectory, `${name}.json`)), `published ${name}`);
  // Read the published plan before any stage below rewrites a file in this output directory.
  const publishedPlan = reuseImages ? { scene: await published('scene'), 'surface-raster-plan': await published('surface-raster-plan'), datasets: await published('datasets') } : null;
  if (reuseImages) {
    const previous = await published('authored-preparation');
    const publishedSources = new Map(requireArray(previous.sources, 'published sources').map(source => requireRecord(source, 'published source'))
      .map(source => [requireString(source.id, 'source id'), JSON.stringify(source)] as const));
    const current = entries.map(entry => entry.reference);
    const changed = [...new Set([...publishedSources.keys(), ...current.map(reference => reference.id)])]
      .filter(sourceId => publishedSources.get(sourceId) !== JSON.stringify(current.find(reference => reference.id === sourceId)));
    const unaccepted = changed.filter(sourceId => !acceptChanged.includes(sourceId));
    if (unaccepted.length) throw new Error(`${descriptor.id}: recipe sources changed since the published preparation (${unaccepted.join(', ')}); run the full preparation, or pass --accept-changed when a change feeds none of the reused outputs.`);
    if (changed.length) console.log(`${descriptor.id}: reusing published outputs across accepted recipe changes: ${changed.join(', ')}.`);
  }
  const sky = prepareCubicSky({ objectId: descriptor.id, cameraContract: CUBIC_SKY_CAMERA_PRESENTATION_STANDARD });
  const destinations = descriptor.recipe.destinations;
  if (publishedPlan) {
    // The reused outputs read the surface raster plan whole, and from the scene only its surface asset banks (texture
    // levels resolve them); the rest of the scene is presentation, which this lane prepares afresh.
    const banks = (plan: Record<string, unknown>) => {
      const body = requireRecord(plan.body, 'scene body'), interior = requireRecord(plan.interior, 'scene interior');
      return { surface: requireRecord(requireRecord(body.assets, 'body assets').surface, 'body surface'), interior: interior.outerAssets };
    };
    if (canonical(banks(publishedPlan.scene)) !== canonical(banks(requireRecord(scene, 'scene'))))
      throw new Error(`${descriptor.id}: scene surface banks differ from the published preparation; run the full preparation.`);
    if (canonical(publishedPlan['surface-raster-plan']) !== canonical(surfaceRasterPlan))
      throw new Error(`${descriptor.id}: surface-raster-plan differs from the published preparation; run the full preparation.`);
  }
  // The atmosphere bank reads only the recipe and the body's photometry, so a reuse run redraws it.
  const recomputedImages = reuseImages ? (await preparePagedEllipsoidAssetsInParallel({ worker: assetWorker, objectDirectory, publicDirectory, mapNames: [], materialsOnly: true })).assets
    .map(asset => { if (!asset.startsWith(config.publicBase)) throw new Error(`${descriptor.id}: material asset ${asset} is outside ${config.publicBase}.`); return asset.slice(config.publicBase.length); }) : [];
  const rasterAssets = reuseImages ? await published('raster-assets') as unknown as Awaited<ReturnType<typeof preparePagedEllipsoidAssets>>
    : await preparePagedEllipsoidAssetsInParallel({ worker: assetWorker, objectDirectory, publicDirectory, mapNames: config.surface.maps.map(map => map.name) });
  const context = { sourceDirectory, publicDirectory, config, scene };
  // The city catalogue is an authored capability (a search over GeoNames places on the globe), not a requirement of a globe.
  // It reads only the scene geometry, so a reuse-images run rebuilds it as well.
  const catalog = destinations ? await preparePlaces(context) : undefined;
  if (catalog && destinations && catalog.count > destinations.maxEntries) throw new TypeError('Prepared places exceed the authored destination capability.');
  const datasets = { ...bindingSource, controls: bindingSource.controls.map(({ surfacePagePrefix, focus, ...dataset }) => {
    return { ...dataset,
    ...(surfacePagePrefix ? { surfaceUrls: raster.surfacePageUrls(surfacePagePrefix, surfaceRasterPlan.pages.length) } : {}),
    ...(focus ? { camera: { ...prepareLocationCamera(scene, prepareLocationPoint(scene, focus.longitude, focus.latitude), focus.zoom, { body: parseBodyAttitude(scene[config.sceneBodyKey]), camera: config.camera, northUp: focus.northUp }), ...(focus.transition ? { transition: focus.transition } : {}) } } : {}),
  }; }) };
  const preparedContent = await prepareContent({ sourceDirectory, publicDirectory, outputDirectory, config: { contentPath: 'content/object.json' } });
  const content = { ...preparedContent.content, ...(catalog ? { destinations: { searchLabel: config.destinations.searchLabel, description: `${catalog.count.toLocaleString('en')}${config.destinations.descriptionSuffix}` } } : {}) };
  const publishedLevels = reuseImages ? await json(resolve(outputDirectory, 'texture-levels.json')).then(value => value === null ? null : requireRecord(value, 'published texture-levels') as unknown as Awaited<ReturnType<typeof prepareTextureLevels>>,
      error => { if ((error as NodeJS.ErrnoException).code === 'ENOENT') return null; throw error; }) : null;
  // A reuse run may drop datasets and texture level widths: their banks, pole atlases and levels leave the published levels,
  // the rest stay as published.
  const textureLevels = reuseImages ? publishedLevels && keepTextureLevelWidths(keepTextureLevelBanks(publishedLevels,
      new Set(surfaceBankInventory(scene, datasets, config.publicBase).map(bank => bank.id)), new Set(datasets.controls.map(dataset => dataset.id))),
      config.textureLevels?.widths ?? [], config.atlas.pageSize)
    : await prepareTextureLevels({ config, plan: scene, datasets, publicDirectory });
  if (textureLevels) await write(outputDirectory, 'texture-levels', textureLevels);
  if (publishedPlan && !publishedSubset(publishedPlan.datasets, datasets)) throw new Error(`${descriptor.id}: datasets differ from the published preparation beyond removed datasets; run the full preparation.`);
  const controls = requireObjectControls(preparedContent.controls, descriptor.id);
  const rawDefinition = await preparePagedEllipsoidPresentation({ config, plan: scene, datasets, sky, sun, catalog, textureLevels, controls });
  const definition = withFocusedCamera(rawDefinition, sky);
  for (const [name, value] of Object.entries({ scene, 'raster-assets': rasterAssets, 'surface-raster-plan': surfaceRasterPlan, sky, sun, ...(catalog ? { places: catalog } : {}), datasets, content, runtime: definition })) await write(outputDirectory, name, value);
  await write(outputDirectory, 'authored-preparation', { schema: 'cssearth-authored-preparation@1', id: descriptor.id, sources: entries.map(entry => entry.reference), lanes: { raster: true, celestial: true, geometry: true, content: true, presentation: true} });
  return { descriptor, sources, raster: rasterAssets, celestial: { sky, sun }, scene, definition, content, recomputedImages };
}

/** Whether `current` is the published datasets less some of them: every remaining control and provenance line is
 * unchanged, and nothing else differs. */
function publishedSubset(published: Record<string, unknown>, current: {controls: readonly {id: string}[]; provenance?: Record<string, unknown>}) {
  const controls = new Map(requireArray(published.controls, 'published dataset controls').map(control => [requireString(requireRecord(control, 'published dataset').id, 'published dataset id'), canonical(control)]));
  const provenance = requireRecord(published.provenance ?? {}, 'published dataset provenance');
  const { controls: _published, provenance: _provenance, ...rest } = published, { controls: currentControls, provenance: currentProvenance = {}, ...currentRest } = current;
  return canonical(rest) === canonical(currentRest) && currentControls.every(control => controls.get(control.id) === canonical(control))
    && Object.entries(currentProvenance).every(([key, value]) => canonical(provenance[key]) === canonical(value));
}
