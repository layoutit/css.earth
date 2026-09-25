import './thread-pool.js';
import { cp, mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { relative, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import sharp from 'sharp';
import type { AuthoredObjectDescriptor } from '@cssearth/objects';
import { readAuthoredSources, type VerifiedSource } from './authored-sources.js';
import { parseRasterRecipe, prepareRasterAssets } from '../../src/preparation/raster/index.js';
import { prepareLighting } from '../../src/renderers/css/preparation/materials/lighting.js';
import { outputName } from '../../src/preparation/raster/io.js';
import { RASTER_DENSITY } from '../../src/preparation/raster/config.js';
import { leafImageCandidates, parseGeometryProfile, prepareGeometryScene, widestLeafImages, type GeometrySceneAssets, type SolarSceneSource } from '../../src/renderers/css/preparation/scene/index.js';
import { parsePresentationProfile, prepareCssPresentation, type PresentationInputs } from '../../src/renderers/css/preparation/presentation/index.js';
import { prepareCelestialAssets } from './celestial/index.js';
import { prepareObjectContentAssets } from './content/prepare.js';
import { loadGeometryAdapters } from './geometry-adapters.js';
import { prepareRuntimeManifest } from './runtime-assets.js';
import { prepareWorldNavigationDefinition, writeWorldNavigationArtifacts } from './prepare-world-navigation.js';
import { attachSurfaceFeatures, writeFeatureContent } from './surface-features/attach.js';

export interface AuthoredPreparationContext { readonly objectDirectory: string; readonly publicDirectory: string; readonly outputDirectory: string; readonly write?: boolean;
  /** Write mode: regenerated reviewed images replace their source copies and pins instead of failing. */
  readonly replaceReviewedImages?: boolean;
  /** Reuse the published heavy outputs and prepare only the presentation; supported by the paged-ellipsoid lane. */
  readonly reuseImages?: boolean;
  /** Recipe sources the author states changed without feeding the reused outputs (reuse-images runs). */
  readonly acceptChanged?: readonly string[]; }
export interface AuthoredPreparationResult { readonly descriptor: AuthoredObjectDescriptor; readonly sources: ReadonlyMap<string, VerifiedSource>; readonly raster?: unknown; readonly celestial?: unknown; readonly scene?: unknown; readonly definition?: unknown; }
type Input = Record<string, unknown>;

function record(value: unknown, at: string): Input { if (!value || typeof value !== 'object' || Array.isArray(value)) throw new TypeError(`${at} must be an object.`); return value as Input; }
function source(sources: ReadonlyMap<string, VerifiedSource>, id: string): VerifiedSource | undefined { return sources.get(id); }
function required(sources: ReadonlyMap<string, VerifiedSource>, id: string): VerifiedSource { const value = source(sources, id); if (!value) throw new TypeError(`Authored recipe requires ${id}.`); return value; }
function sourceRecord(value: unknown, at: string): Record<string, unknown> { return record(value, at); }
function physicalSolarSource(value: unknown): SolarSceneSource {
  const input = record(value, 'solar-system source');
  if (typeof input.bodyId !== 'string' || typeof input.displayName !== 'string' || typeof input.bodyRadiusUnits !== 'number' || !(input.bodyRadiusUnits > 0) || typeof input.bodyRadiusKilometers !== 'number' || !(input.bodyRadiusKilometers > 0)) throw new TypeError('Solar-system source lacks physical scene parameters.');
  return Object.freeze({ ...input, bodyId: input.bodyId, displayName: input.displayName, bodyRadiusUnits: input.bodyRadiusUnits, bodyRadiusKilometers: input.bodyRadiusKilometers });
}
function ids(value: unknown, at: string): Set<string> { if (!Array.isArray(value) || value.some(item => !item || typeof item !== 'object' || typeof (item as Record<string, unknown>).id !== 'string')) throw new TypeError(`${at} needs identified records.`); return new Set(value.map(item => (item as Record<string, unknown>).id as string)); }
function sameIds(actual: Set<string>, expected: Set<string>, at: string): void { if (actual.size !== expected.size || [...actual].some(id => !expected.has(id))) throw new TypeError(`${at} does not match the authored capability declaration.`); }
function validateCapabilityComposition(descriptor: AuthoredObjectDescriptor, rasterConfig: Record<string, unknown>, geometryConfig: Record<string, unknown>, solar: SolarSceneSource, lenses: unknown): void {
  if (Math.abs(descriptor.recipe.shape.radiusKm - solar.bodyRadiusKilometers) > 1e-9) throw new TypeError('Authored shape radius differs from the physical source.');
  const materialSources = new Set(descriptor.recipe.materials?.map(item => item.source));
  if (materialSources.has('raster') && rasterConfig.lighting === undefined && rasterConfig.atmosphere === undefined && rasterConfig.emission === undefined) throw new TypeError('Authored material has no prepared raster backend.');
  if (Boolean(descriptor.recipe.emission) !== Boolean(rasterConfig.emission)) throw new TypeError('Authored emission and its prepared raster backend disagree.');
  if (Boolean(descriptor.recipe.cutaway) !== Boolean(rasterConfig.interior) || Boolean(descriptor.recipe.cutaway) !== Boolean(geometryConfig.cutaway)) throw new TypeError('Authored cutaway and its prepared geometry/assets disagree.');
  if (Boolean(descriptor.recipe.atmosphere) !== Boolean(rasterConfig.atmosphere)) throw new TypeError('Authored atmosphere and its prepared raster backend disagree.');
  const declared = new Set(descriptor.recipe.surfaces.flatMap(surface => surface.lenses.map(lens => lens.id)));
  // A dataset that names a companion cloud borrows a prepared surface instead of owning one, so it is not a surface
  // lens and the recipe does not declare it. Its own contract check is that the surface it borrows exists.
  const controls = record(lenses, 'prepared lenses').controls as { id?: unknown; volume?: { surface?: unknown } }[];
  const surfaces = controls.filter(control => control.volume === undefined || control.volume.surface === control.id);
  const prepared = ids(surfaces, 'prepared lenses.controls');
  sameIds(prepared, declared, 'Prepared lenses');
  for (const control of controls) {
    if (control.volume === undefined) continue;
    if (!declared.has(String(control.volume.surface))) throw new TypeError(`Prepared lens ${String(control.id)} borrows an unprepared surface.`);
  }
}
async function writePreparedObject(id: string, definition: Record<string, unknown>): Promise<void> {
  const module = record(await import(pathToFileURL(resolve(process.cwd(), 'tools/prepare/prepare-object-json.mts')).href), 'prepared object writer');
  const write = module.writeObjectJson;
  if (typeof write !== 'function') throw new TypeError('Prepared object writer is missing.');
  await (write as (objectId: string, runtime: Record<string, unknown>) => Promise<unknown>)(id, definition);
}

/** Verify authored source pins, then prepare each available generic capability lane. */
export async function prepareAuthoredObject({ objectDirectory, publicDirectory, outputDirectory, write = false, replaceReviewedImages = write, reuseImages = false, acceptChanged = [] }: AuthoredPreparationContext): Promise<AuthoredPreparationResult> {
  const result = await prepareAuthoredStages({ objectDirectory, publicDirectory, outputDirectory, write, replaceReviewedImages, reuseImages, acceptChanged });
  if (write || !result.definition) return result;
  const { prepareSurfaceMinimaps } = await import(pathToFileURL(resolve(process.cwd(), 'tools/prepare/prepare-surface-minimaps.mts')).href);
  // Minimaps render from the raw imagery; a reuse-images stage already carries the published ones.
  if (!reuseImages) await prepareSurfaceMinimaps({ objectDirectory, publicDirectory, outputDirectory });
  const prepared = await prepareWorldNavigationDefinition({ objectDirectory, definition: result.definition as Record<string, unknown> });
  await assertDefaultViewsFaceLenses(objectDirectory, prepared.definition as Record<string, unknown>, prepared.frame);
  const scene = await writeWorldNavigationArtifacts(outputDirectory, prepared, result.scene as Record<string, unknown> | undefined);
  // Provenance verifies raw source bytes; a reuse-images stage carries the published record for its unchanged images.
  if (!reuseImages) {
    const { prepareObjectProvenance } = await import(pathToFileURL(resolve(process.cwd(), 'tools/objects/provenance.mts')).href);
    await prepareObjectProvenance({ objectDirectory, publicDirectory, outputDirectory, basis: 'prepared' });
  }
  return Object.freeze({ ...result, definition: prepared.definition, scene });
}

/** Legend labels of the object's content record against the stretch a staged or checked run reported (legend-labels.mts). */
export async function stagedLegendLabelChanges(objectDirectory: string, preparedDirectory: string) {
  const { legendLabelChanges, withDerivedLegendLabels } = await import(pathToFileURL(resolve(process.cwd(), 'tools/objects/legend-labels.mts')).href) as typeof import('./legend-labels.mts');
  const { descriptor } = await readAuthoredSources(objectDirectory);
  const contentReference = descriptor.recipe.sources.find(entry => entry.id === 'content');
  const assets = await readFile(resolve(preparedDirectory, 'assets.json'), 'utf8').catch(() => null);
  if (!contentReference || assets === null) return { changes: [], summary: '', contentPath: '', refreshed: null };
  const contentPath = resolve(objectDirectory, contentReference.path), content = record(JSON.parse(await readFile(contentPath, 'utf8')) as unknown, 'content');
  const changes = legendLabelChanges(content, JSON.parse(assets) as unknown);
  return { changes, contentPath, refreshed: withDerivedLegendLabels(content, changes),
    summary: changes.map(change => `${change.lensId} ${JSON.stringify(change.authored)} -> ${JSON.stringify(change.derived)}`).join('; ') };
}

/** A photograph lens states the body point its frame looks at; the default camera must look there too (default-view/geometry.mts). The check
 * reads the final frame, which follows the body as drawn. */
async function assertDefaultViewsFaceLenses(objectDirectory: string, definition: Record<string, unknown>, frame: unknown): Promise<void> {
  const { descriptor, sources } = await readAuthoredSources(objectDirectory);
  const raster = source(sources, 'raster')?.value as { surfaces?: { science?: { kind?: string; lens?: unknown } }[] } | undefined;
  for (const surface of raster?.surfaces ?? []) {
    const science = surface.science;
    if (!science || science.kind !== 'surface-observation') continue;
    const frames = record(science.lens, 'surface-observation lens').frames;
    const lensFrame = Array.isArray(frames) && frames.length === 1 ? record(frames[0], 'lens frame') : null;
    if (!lensFrame || typeof lensFrame.observerWestLongitude !== 'number' || typeof lensFrame.observerLatitude !== 'number') continue;
    const { assertDefaultViewFacesLens } = await import(pathToFileURL(resolve(process.cwd(), 'tools/objects/default-view/geometry.mts')).href) as typeof import('./default-view/geometry.mts');
    assertDefaultViewFacesLens(descriptor.id, definition.camera as never, frame as never, { longitudeDegrees: -lensFrame.observerWestLongitude, latitudeDegrees: lensFrame.observerLatitude });
  }
}

/** Feature anchors address scene-tree nodes, so they carry over only while the tree keeps the published node topology. A node's
 * style and the shared declaration table may change (a leaf's raster size, say) without moving any node. */
function carryPublishedFeatures(id: string, definition: Record<string, unknown>, published: { runtime: Record<string, unknown>; content: Record<string, unknown> }) {
  if (published.runtime.features === undefined) return { definition, features: null };
  // Finalization appends nodes and activation groups to the lane's tree; the lane's own tree must be the published prefix.
  const tree = record(definition.tree, 'prepared tree'), previous = record(published.runtime.tree, 'published tree');
  const nodes = Array.isArray(tree.nodes) ? tree.nodes : [], previousNodes = Array.isArray(previous.nodes) ? previous.nodes : [];
  const topology = (list: unknown[]) => JSON.stringify(list.map(node => {
    const { parent, tag, className, attributes } = record(node, 'prepared tree node');
    return [parent, tag, className, attributes];
  }));
  const differs = ([key, value]: [string, unknown]) => key === 'properties' ? false
    : key === 'nodes' ? topology(previousNodes.slice(0, nodes.length)) !== topology(nodes)
      : JSON.stringify(previous[key]) !== JSON.stringify(value);
  if (Object.entries(tree).some(differs)) throw new Error(`${id}: the scene tree differs from the published preparation, so its feature anchors cannot carry over; run the full preparation.`);
  return { definition: { ...definition, features: published.runtime.features },
    features: record(published.content.features, 'published feature content') as unknown as Parameters<typeof writeFeatureContent>[1] };
}

async function prepareAuthoredStages({ objectDirectory, publicDirectory, outputDirectory, write = false, replaceReviewedImages = false, reuseImages = false, acceptChanged = [] }: AuthoredPreparationContext): Promise<AuthoredPreparationResult> {
  if (write) {
    const id = record(JSON.parse(await readFile(resolve(objectDirectory, 'object.json'), 'utf8')), 'descriptor').id;
    if (typeof id !== 'string' || !/^[a-z][a-z0-9-]*$/u.test(id)) throw new TypeError('Invalid preparation identity.');
    const projectRoot = process.cwd(), stageRoot = resolve(projectRoot, '.local/object-preparation');
    await mkdir(stageRoot, { recursive: true });
    const stage = await mkdtemp(resolve(stageRoot, `${id}-`));
    try {
      const stagedPublic = resolve(stage, 'public'), stagedData = resolve(stage, 'prepared');
      // The stage starts from the published set; publication verifies every carried image against the new manifest.
      // Only inventoried files are carried: a local leftover in prepared/ or public/ must not be published with them.
      if (reuseImages) {
        const inventoried = new Map<string, Set<string>>();
        for (const asset of (JSON.parse(await readFile(resolve(objectDirectory, 'inventory.json'), 'utf8')) as { assets: { location: string; filename: string }[] }).assets)
          (inventoried.get(asset.location) ?? inventoried.set(asset.location, new Set()).get(asset.location)!).add(asset.filename);
        const published = (location: string, root: string) => (path: string) => {
          const name = relative(root, path), names = inventoried.get(location) ?? new Set<string>();
          return path === root || names.has(name) || [...names].some(file => file.startsWith(`${name}/`));
        };
        await Promise.all([cp(outputDirectory, stagedData, { recursive: true, filter: published('prepared', outputDirectory) }),
          cp(publicDirectory, stagedPublic, { recursive: true, filter: published('public', publicDirectory) })]);
      }
      const result = await prepareAuthoredObject({ objectDirectory, publicDirectory: stagedPublic, outputDirectory: stagedData, replaceReviewedImages, reuseImages, acceptChanged });
      if (!result.definition) throw new TypeError('Preparation produced no runtime payload.');
      // Palette legend labels are derived from the stretch this run just measured: refresh them, repin, and prepare again.
      const legend = await stagedLegendLabelChanges(objectDirectory, stagedData);
      if (legend.changes.length) {
        if (process.env.CSSEARTH_PREPARATION_TRACE) throw new Error(`${id}: legend labels differ from the prepared stretch: ${legend.summary}.`);
        await writeFile(legend.contentPath, `${JSON.stringify(legend.refreshed, null, 2)}\n`);
        console.log(`refreshed legend labels ${legend.summary}`);
        return await prepareAuthoredStages({ objectDirectory, publicDirectory, outputDirectory, write, replaceReviewedImages, reuseImages, acceptChanged });
      }
      const { finalizeObjectJson } = await import(pathToFileURL(resolve(projectRoot, 'tools/prepare/prepare-object-json.mts')).href) as typeof import('../prepare/prepare-object-json.mts');
      const finalized = await finalizeObjectJson(id, result.definition, { projectRoot, objectDirectory, preparedDirectory: stagedData,
        descriptorPath: resolve(stage, 'object.json') }, { publicDirectory: stagedPublic });
      if (reuseImages) {
        // The carried provenance describes the reused images. Charts are regenerated by content preparation,
        // so their declared SVG outputs may change; all other published images must remain byte-identical.
        // Public JSON catalogues (places, features) are derived from the scene and may be regenerated here.
        // The staged inventory holds the run's public entries; the object's also holds its prepared entries.
        const published = async (path: string) => (JSON.parse(await readFile(path, 'utf8')) as { assets: { location: string; filename: string; bytes?: number; sha256?: string }[] }).assets
          .filter(asset => asset.location === 'public' && !asset.filename.endsWith('.json'));
        const stagedImages = await published(resolve(stagedData, 'inventory.json'));
        const existingImages = await published(resolve(objectDirectory, 'inventory.json'));
        if (JSON.stringify(stagedImages) !== JSON.stringify(existingImages)) {
          const existing = new Map(existingImages.map(asset => [asset.filename, asset]));
          const staged = new Map(stagedImages.map(asset => [asset.filename, asset]));
          const changed = [...new Set([...existing.keys(), ...staged.keys()])].filter(filename => JSON.stringify(existing.get(filename)) !== JSON.stringify(staged.get(filename)));
          const chartSource = result.sources.get('charts')?.value as { charts?: { output?: unknown }[] } | undefined;
          const chartOutputs = new Set(chartSource?.charts?.map(chart => chart.output).filter((output): output is string => typeof output === 'string' && output.endsWith('.svg')) ?? []);
          // The lighting stage is recomputed from its recipe, and may add the shadowless frames the published set predates.
          const lightingRecipe = (result.sources.get('raster')?.value as { lighting?: { billboardOutput?: unknown } } | undefined)?.lighting;
          const billboardName = typeof lightingRecipe?.billboardOutput === 'string' ? outputName(lightingRecipe.billboardOutput, RASTER_DENSITY) : null;
          const shadowless = new Set(billboardName ? ['shadowless', 'shadowless-billboard'].map(name => billboardName.replace('billboard', name)) : []);
          const unexpected = changed.filter(filename => !chartOutputs.has(filename) && !(shadowless.has(filename) && !existing.has(filename)));
          if (unexpected.length || !changed.length)
            throw new Error(`${id}: the presentation changed the published image set (${unexpected.join(', ') || 'order only'}); run the full preparation.`);
        }
      } else {
        const { prepareObjectProvenance } = await import(pathToFileURL(resolve(projectRoot, 'tools/objects/provenance.mts')).href) as typeof import('./provenance.mts');
        await prepareObjectProvenance({ objectDirectory, publicDirectory: stagedPublic, outputDirectory: stagedData, basis: 'prepared' });
      }
      const { publishPreparedObject } = await import(pathToFileURL(resolve(projectRoot, 'tools/objects/publication.mts')).href) as typeof import('./publication.mts');
      await publishPreparedObject({ id, stage, objectDirectory, publicDirectory, outputDirectory, projectRoot });
      return Object.freeze({ ...result, definition: finalized.definition,
        scene: JSON.parse(await readFile(resolve(stagedData, 'scene.json'), 'utf8')) as unknown });
    } finally { await rm(stage, { recursive: true, force: true }); }
  }
  const descriptorPath = resolve(objectDirectory, 'object.json');
  // Every recipe source is verified against the source manifest, the one owner of input pins.
  const { descriptor, entries, sources } = await readAuthoredSources(objectDirectory);
  // Nomenclature labels ride the generic sphere lane; other lanes declare no mesh anchor frame yet.
  // --reuse-images keeps the published images and rebuilds only what the tracked recipes describe (scene, presentation,
  // content), so it needs no raw downloads. The paged-ellipsoid lane and the generic raster lane support it.
  const genericRasterLane = (source(sources, 'raster')?.value as Record<string, unknown> | undefined)?.schema === 'cssearth-raster-recipe@1' &&
    !['terrestrial', 'shape-model'].some(id => source(sources, id)) &&
    !['cssearth-layered-oblate-preparation@1', 'cssearth-banded-ellipsoid@1'].includes(String((source(sources, 'geometry')?.value as Record<string, unknown> | undefined)?.schema));
  if (reuseImages && !source(sources, 'paged-ellipsoid') && !genericRasterLane) throw new TypeError(`${descriptor.id}: --reuse-images supports the paged-ellipsoid and raster lanes only.`);
  const genericLaneOnly = () => { if (descriptor.recipe.features) throw new TypeError('Surface features are prepared by the generic authored lane only.'); };
  await mkdir(outputDirectory, { recursive: true });
  const sourceDirectory = resolve(objectDirectory, 'source');
  if ((source(sources, 'geometry')?.value as Record<string, unknown> | undefined)?.schema === 'cssearth-layered-oblate-preparation@1') {
    genericLaneOnly();
    const { prepareLayeredOblateObject } = await import(pathToFileURL(resolve(process.cwd(), 'tools/objects/material-composition/index.mts')).href) as typeof import('./material-composition/index.mts');
    return prepareLayeredOblateObject({ objectDirectory, publicDirectory, outputDirectory, write, prepareContent: prepareObjectContentAssets });
  }
  if (source(sources, 'paged-ellipsoid')) {
    const { preparePagedEllipsoidObject } = await import(pathToFileURL(resolve(process.cwd(), 'tools/objects/paged-ellipsoid/index.mts')).href) as typeof import('./paged-ellipsoid/index.mts');
    // A reuse-images run carries the published feature anchors; read them before the lane rewrites this directory.
    const publishedFeatures = reuseImages ? {
      runtime: record(JSON.parse(await readFile(resolve(outputDirectory, 'runtime.json'), 'utf8')), 'published runtime'),
      content: record(JSON.parse(await readFile(resolve(outputDirectory, 'content.json'), 'utf8')), 'published content') } : null;
    const prepared = await preparePagedEllipsoidObject({ objectDirectory, publicDirectory, outputDirectory, prepareContent: prepareObjectContentAssets, reuseImages, acceptChanged });
    // Named features anchor on the rendered ellipsoid (attach.ts casts map directions through the lane's own surface sampler).
    const attached = publishedFeatures ? carryPublishedFeatures(descriptor.id, prepared.definition as unknown as Record<string, unknown>, publishedFeatures)
      : await attachSurfaceFeatures({ descriptor, sources, sourceDirectory, publicDirectory, outputDirectory, definition: prepared.definition as unknown as Record<string, unknown> });
    if (attached.features) { await writeFile(resolve(outputDirectory, 'runtime.json'), `${JSON.stringify(attached.definition)}\n`); await writeFeatureContent(outputDirectory, attached.features); }
    const definition = attached.definition as typeof prepared.definition;
    await prepareRuntimeManifest({ id: descriptor.id, publicRoot: publicDirectory,
      objectDirectory: write ? objectDirectory : outputDirectory,
      allowPreparationArtifacts: true,
      values: [definition, prepared.content] });
    if (write) await writePreparedObject(descriptor.id, definition);
    return Object.freeze({ ...prepared, definition });
  }
  if ((source(sources, 'geometry')?.value as Record<string, unknown> | undefined)?.schema === 'cssearth-banded-ellipsoid@1') {
    genericLaneOnly();
    const { prepareLayeredGiantObject } = await import(pathToFileURL(resolve(process.cwd(), 'tools/objects/giant-layers/object.mts')).href) as typeof import('./giant-layers/object.mts');
    const prepared = await prepareLayeredGiantObject({ objectDirectory, publicDirectory, outputDirectory, prepareContent: prepareObjectContentAssets });
    await prepareRuntimeManifest({ id: descriptor.id, publicRoot: publicDirectory,
      objectDirectory: write ? objectDirectory : outputDirectory,
      values: [prepared.raster, prepared.celestial, prepared.scene, prepared.definition, prepared.content] });
    if (write) await writePreparedObject(descriptor.id, prepared.definition);
    return Object.freeze({ ...prepared });
  }
  if (source(sources, 'shape-model')) {
    genericLaneOnly();
    const { prepareShapeModel } = await import(pathToFileURL(resolve(process.cwd(), 'tools/objects/shape-model/index.mts')).href) as typeof import('./shape-model/index.mts');
    const prepared = await prepareShapeModel({ descriptor, sources, objectDirectory, publicDirectory, outputDirectory, prepareContent: prepareObjectContentAssets });
    await prepareRuntimeManifest({ id: descriptor.id, publicRoot: publicDirectory, objectDirectory: outputDirectory, allowPreparationArtifacts: true, values: [prepared.definition, prepared.content] });
    return Object.freeze({ descriptor, sources, ...prepared });
  }
  if (source(sources, 'terrestrial')) {
    const terrestrial = record(required(sources, 'terrestrial').value, 'terrestrial');
    if (Boolean(terrestrial.rings) !== Boolean(descriptor.recipe.rings)) throw new TypeError('Prepared terrestrial rings must match the authored capability.');
    const { prepareTerrestrialLayers } = await import(pathToFileURL(resolve(process.cwd(), 'tools/objects/terrestrial-layers/index.mts')).href) as typeof import('./terrestrial-layers/index.mts');
    const terrestrialPrepared = await prepareTerrestrialLayers({ sourceDirectory, publicDirectory, outputDirectory,
      config: terrestrial, prepareContent: prepareObjectContentAssets, replaceReviewedImages });
    const terrestrialAttached = await attachSurfaceFeatures({ descriptor, sources, sourceDirectory, publicDirectory, outputDirectory, definition: terrestrialPrepared.definition as unknown as Record<string, unknown> });
    if (terrestrialAttached.features) await writeFeatureContent(outputDirectory, terrestrialAttached.features);
    // Triangle faces also publish atlases masked to their triangles, for browsers without corner-shape.
    const { prepareTriangleAlphaAtlases } = await import(pathToFileURL(resolve(process.cwd(), 'tools/objects/terrestrial-layers/triangle-alpha-atlas.mts')).href) as typeof import('./terrestrial-layers/triangle-alpha-atlas.mts');
    const terrestrialDefinition = await prepareTriangleAlphaAtlases(terrestrialAttached.definition as never, { namespace: descriptor.id, publicDirectory, publicBase: `/scenes/${descriptor.id}/` });
    await writeFile(resolve(outputDirectory, 'runtime.json'), `${JSON.stringify(terrestrialDefinition)}\n`);
    const prepared = { ...terrestrialPrepared, definition: terrestrialDefinition as typeof terrestrialPrepared.definition };
    await prepareRuntimeManifest({ id: descriptor.id, publicRoot: publicDirectory,
      objectDirectory: write ? objectDirectory : outputDirectory,
      allowPreparationArtifacts: true,
      values: [prepared.definition, prepared.content] });
    if (write) await writePreparedObject(descriptor.id, prepared.definition);
    return Object.freeze({ descriptor, sources, ...prepared });
  }
  // Scientific and observed surfaces are interpreted by their existing decoder owners (observation rasters,
  // terrestrial decoders, GLB base colour, solar synoptic maps) before the raster lane packs them; src never imports tools.
  const rasterConfig = parseRasterRecipe(required(sources, 'raster').value);
  const solarSource = physicalSolarSource(required(sources, 'solar-system').value);
  if (reuseImages && (source(sources, 'observations') || source(sources, 'rings')))
    throw new TypeError(`${descriptor.id}: --reuse-images cannot carry observed surfaces or radial layers, which publish their own images; run the full preparation.`);
  // With --reuse-images the published image metadata, sky and Sun stand in for the stages that read raw downloads; the
  // published features are read here, before the lane rewrites this directory.
  const publishedJson = async (name: string) => JSON.parse(await readFile(resolve(outputDirectory, `${name}.json`), 'utf8')) as unknown;
  const publishedFeatures = reuseImages ? { runtime: record(await publishedJson('runtime'), 'published runtime'),
    content: record(await publishedJson('content'), 'published content') } : null;
  const reused = reuseImages ? record(await publishedJson('assets'), 'published raster assets') as unknown as Awaited<ReturnType<typeof prepareRasterAssets>> : null;
  // Lighting frames come from the recipe alone, never from raw downloads, so a reuse run recomputes them (a shared bank's are
  // copied): the published metadata may predate a lighting output, such as the shadowless frame.
  if (reused && rasterConfig.lighting) {
    Object.assign(reused, { lighting: await prepareLighting(rasterConfig, rasterConfig.lighting, publicDirectory) });
    await writeFile(resolve(outputDirectory, 'assets.json'), `${JSON.stringify(reused)}\n`);
  }
  const raster = reused ?? await prepareRasterAssets({ sourceDirectory, publicDirectory, outputDirectory, config: rasterConfig,
      interpret: await (await import(pathToFileURL(resolve(process.cwd(), 'tools/objects/observation/interpret.mts')).href) as typeof import('./observation/interpret.mts'))
        .createSurfaceInterpreter({ objectId: descriptor.id, displayName: solarSource.displayName, sourceDirectory, recipe: rasterConfig }) });
  // A body may take its surfaces from an observed-surfaces recipe rather than this lane, which then prepares only its
  // lighting bank. The observed products are published beside it and the lenses name them, as they name any other surface.
  const observationsSource = source(sources, 'observations');
  const observed = observationsSource
    ? await (await import(pathToFileURL(resolve(process.cwd(), 'tools/objects/observed-surfaces/index.mts')).href) as typeof import('./observed-surfaces/index.mts'))
        .prepareObservedSurfaces({ sourceDirectory, publicDirectory, config: observationsSource.value, write: true })
    : null;
  // A body may also declare radial layers, such as a ring, whose image this lane publishes beside the surfaces; the
  // geometry profile places it as a plane.
  const ringsSource = source(sources, 'rings');
  const radial = ringsSource
    ? await (await import(pathToFileURL(resolve(process.cwd(), 'tools/objects/giant-layers/index.mts')).href) as typeof import('./giant-layers/index.mts'))
        .prepareGiantLayers({ sourceDirectory, publicDirectory, config: ringsSource.value, write: true })
    : null;
  const celestial = reuseImages
    ? { sky: await publishedJson('sky'), sun: await publishedJson('sun') } as unknown as Awaited<ReturnType<typeof prepareCelestialAssets>>
    : await prepareCelestialAssets({ sourceDirectory, publicDirectory, outputDirectory, config: required(sources, 'celestial').value });
  const geometryConfig = parseGeometryProfile(required(sources, 'geometry').value);
  // A body outside the ephemeris tables (the Sun) frames its scene from the authored world context.
  const contextSource = source(sources, 'world-context');
  let worldContext: unknown;
  if (contextSource) {
    const { prepareSpatialContext } = await import(pathToFileURL(resolve(process.cwd(), 'tools/objects/dist/prepare-spatial-context.js')).href) as typeof import('./prepare-spatial-context.js');
    const outputPath = resolve(outputDirectory, 'world-context.json');
    await prepareSpatialContext({ sourcePath: contextSource.path, outputPath, solarGeometryPath: resolve(process.cwd(), 'src/platform/solar-geometry.mts'), objectsDirectory: resolve(objectDirectory, '..') });
    worldContext = JSON.parse(await readFile(outputPath, 'utf8')) as unknown;
  }
  // Rings the radial lane drew as wedges tell the scene where each ring begins, by the atlas the geometry names.
  const ringWedges = Object.fromEntries((radial?.assets ?? []).flatMap(asset => 'wedges' in asset && asset.wedges ? [[asset.filename, asset.wedges] as const] : []));
  // The lenses name every image a leaf can show, so content is prepared before the scene sizes its leaves.
  const contentReference = required(sources, 'content');
  const content = await prepareObjectContentAssets({ sourceDirectory, publicDirectory, outputDirectory, config: { contentPath: relative(sourceDirectory, contentReference.path) } });
  // Each leaf holds the widest image it can show at two texels per CSS pixel, measured from the files this run published.
  const imagePixels = await widestLeafImages(descriptor.id, leafImageCandidates({ objectId: descriptor.id, profile: geometryConfig, raster: rasterConfig,
    lenses: content.lenses, interior: raster.interior }), async url => {
    if (!url.startsWith(rasterConfig.publicBase)) throw new TypeError(`${descriptor.id}: leaf image ${url} is not under ${rasterConfig.publicBase}.`);
    const path = resolve(publicDirectory, url.slice(rasterConfig.publicBase.length));
    const { width } = await sharp(path).metadata().catch((error: unknown) => { throw new Error(`${descriptor.id}: leaf image ${url} (${path}) cannot be measured.`, { cause: error }); });
    return width ?? Number.NaN;
  });
  const scene = await prepareGeometryScene({ profile: geometryConfig, raster: rasterConfig,
    assets: { ...(raster as unknown as GeometrySceneAssets), ...(Object.keys(ringWedges).length ? { ringWedges } : {}) }, solarSource, starfield: celestial.sky as unknown as Record<string, unknown>, sun: celestial.sun as unknown as Record<string, unknown> | null, ...(worldContext !== undefined ? { worldContext } : {}), adapters: await loadGeometryAdapters(), outputDirectory, imagePixels });
  validateCapabilityComposition(descriptor, rasterConfig as unknown as Record<string, unknown>, geometryConfig as unknown as Record<string, unknown>, solarSource, content.lenses);
  const presentation = parsePresentationProfile(required(sources, 'presentation').value);
  const definition = await prepareCssPresentation({ namespace: presentation.namespace, mode: presentation.mode, ...(presentation.lensFocus ? { lensFocus: presentation.lensFocus } : {}), scene: scene as unknown as PresentationInputs['scene'], assets: raster as unknown as PresentationInputs['assets'], lenses: content.lenses as unknown as PresentationInputs['lenses'], sun: celestial.sun as unknown as PresentationInputs['sun'], solarSource: solarSource as unknown as PresentationInputs['solarSource'], controls: content.controls as unknown as PresentationInputs['controls'] });
  const attached = publishedFeatures ? carryPublishedFeatures(descriptor.id, definition as unknown as Record<string, unknown>, publishedFeatures)
    : await attachSurfaceFeatures({ descriptor, sources, sourceDirectory, publicDirectory, outputDirectory, definition: definition as unknown as Record<string, unknown> });
  const runtime = attached.definition, features = attached.features !== null;
  if (attached.features) await writeFeatureContent(outputDirectory, attached.features);
  await writeFile(resolve(outputDirectory, 'runtime.json'), `${JSON.stringify(runtime)}\n`);
  await prepareRuntimeManifest({ id: descriptor.id, publicRoot: publicDirectory,
    objectDirectory: write ? objectDirectory : outputDirectory,
    values: [raster, celestial, scene, runtime, content,
      // Observed surfaces and radial layers publish their own files; the manifest reads them by url, as it reads every other asset.
      ...[observed, radial].filter(entry => entry !== null).map(entry => {
        const source = entry as { assets: { filename: string; data?: Uint8Array }[] };
        return { schema: 'cssearth-prepared-published-assets@1',
          assets: source.assets.map(({ data: _data, filename, ...rest }) => ({ ...rest, filename, url: `/scenes/${descriptor.id}/${filename}` })) };
      })] });
  if (write) {
    const descriptorData = record(JSON.parse(await readFile(descriptorPath, 'utf8')) as unknown, 'descriptor');
    const properties = record(descriptorData.properties, 'descriptor.properties');
    await writeFile(descriptorPath, `${JSON.stringify({ ...descriptorData, properties: { ...properties, worldFrame: scene.worldFrame } }, null, 2)}\n`);
    await writePreparedObject(descriptor.id, runtime as unknown as Record<string, unknown>);
  }
  const result = Object.freeze({ descriptor, sources, raster, celestial, scene, definition: runtime });
  await writeFile(resolve(outputDirectory, 'authored-preparation.json'), `${JSON.stringify({ schema: 'cssearth-authored-preparation@1', id: descriptor.id, sources: entries.map(entry => entry.reference), lanes: { raster: true, celestial: true, geometry: true, content: true, presentation: true, ...(features ? { features: true } : {}) } })}\n`);
  return result;
}

const [id, ...flags] = process.argv.slice(2);
const direct = process.argv[1] !== undefined && import.meta.url === pathToFileURL(resolve(process.argv[1])).href;
if (direct) {
  const accepting = flags.find(flag => flag.startsWith('--accept-changed='));
  if (!id || !/^[a-z][a-z0-9-]*$/u.test(id) || flags.some(flag => flag !== '--write' && flag !== '--reuse-images' && flag !== accepting) || new Set(flags).size !== flags.length ||
      (flags.includes('--reuse-images') && !flags.includes('--write')) || (accepting && !flags.includes('--reuse-images')))
    throw new TypeError('Usage: prepare-authored <object-id> [--write [--reuse-images [--accept-changed=<source-id,...>]]].');
  const acceptChanged = accepting ? accepting.slice('--accept-changed='.length).split(',').filter(Boolean) : [];
  if (acceptChanged.some(source => !/^[a-z][a-z0-9-]*$/u.test(source))) throw new TypeError('--accept-changed takes recipe source ids.');
  const root = process.cwd(), write = flags.includes('--write'), reuseImages = flags.includes('--reuse-images');
  const result = await prepareAuthoredObject({ objectDirectory: resolve(root, 'src/objects', id), publicDirectory: write ? resolve(root, 'public/scenes', id) : resolve(root, '.local/full-json-migration/staged-public', id), outputDirectory: write ? resolve(root, 'src/objects', id, 'prepared') : resolve(root, '.local/full-json-migration/staged', id), write, reuseImages, acceptChanged });
  if (!write) {
    // A check run refuses labels its own report contradicts; write mode rewrites them.
    const legend = await stagedLegendLabelChanges(resolve(root, 'src/objects', id), resolve(root, '.local/full-json-migration/staged', id));
    if (legend.changes.length) throw new Error(`${id}: legend labels differ from the prepared stretch: ${legend.summary}; run prepare-authored ${id} --write.`);
  }
  console.log(JSON.stringify({ id: result.descriptor.id, runtime: result.definition !== undefined }));
}
