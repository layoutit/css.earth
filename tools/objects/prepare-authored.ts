import { createHash } from 'node:crypto';
import { cp, mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { relative, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { type AuthoredObjectDescriptor } from '@cssearth/objects';
import { readAuthoredSources, type VerifiedSource } from './authored-sources.js';
import { parseRasterRecipe, prepareRasterAssets } from '../../src/preparation/raster/index.js';
import { parseGeometryProfile, prepareGeometryScene, type GeometrySceneAssets, type SolarSceneSource } from '../../src/renderers/css/preparation/scene/index.js';
import { parsePresentationProfile, prepareCssPresentation, type PresentationInputs } from '../../src/renderers/css/preparation/presentation/index.js';
import { prepareCelestialAssets } from './celestial/index.js';
import { prepareObjectContentAssets } from './content/prepare.js';
import { loadGeometryAdapters } from './geometry-adapters.js';
import { prepareRuntimeManifest } from './operations.js';
import { prepareWorldNavigationDefinition, writeWorldNavigationArtifacts } from './prepare-world-navigation.js';
import { attachSurfaceFeatures, writeFeatureContent } from './surface-features/attach.js';

export interface AuthoredPreparationContext { readonly objectDirectory: string; readonly publicDirectory: string; readonly outputDirectory: string; readonly write?: boolean;
  /** Write mode: regenerated reviewed images replace their source copies and pins instead of failing. */
  readonly replaceReviewedImages?: boolean;
  /** Reuse the published heavy outputs and prepare only the presentation; supported by the paged-ellipsoid lane. */
  readonly presentationOnly?: boolean; }
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
export async function prepareAuthoredObject({ objectDirectory, publicDirectory, outputDirectory, write = false, replaceReviewedImages = write, presentationOnly = false }: AuthoredPreparationContext): Promise<AuthoredPreparationResult> {
  const result = await prepareAuthoredStages({ objectDirectory, publicDirectory, outputDirectory, write, replaceReviewedImages, presentationOnly });
  if (write || !result.definition) return result;
  const { prepareSurfaceMinimaps } = await import(pathToFileURL(resolve(process.cwd(), 'tools/prepare/prepare-surface-minimaps.mts')).href);
  // Minimaps render from the raw imagery; a presentation-only stage already carries the published ones.
  if (!presentationOnly) await prepareSurfaceMinimaps({ objectDirectory, publicDirectory, outputDirectory });
  const prepared = await prepareWorldNavigationDefinition({ objectDirectory, definition: result.definition as Record<string, unknown> });
  await assertDefaultViewsFaceLenses(objectDirectory, prepared.definition as Record<string, unknown>, prepared.frame);
  const scene = await writeWorldNavigationArtifacts(outputDirectory, prepared, result.scene as Record<string, unknown> | undefined);
  // Provenance verifies raw source bytes; a presentation-only stage carries the published record for its unchanged images.
  if (!presentationOnly) {
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

/** A photograph lens states the body point its frame looks at; the default camera must look there too (default-view.mts). The check
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
    const { assertDefaultViewFacesLens } = await import(pathToFileURL(resolve(process.cwd(), 'tools/objects/default-view.mts')).href) as typeof import('./default-view.mts');
    assertDefaultViewFacesLens(descriptor.id, definition.camera as never, frame as never, { longitudeDegrees: -lensFrame.observerWestLongitude, latitudeDegrees: lensFrame.observerLatitude });
  }
}

/** Feature anchors address scene-tree nodes, so they carry over only while the tree is the published one. */
function carryPublishedFeatures(id: string, definition: Record<string, unknown>, published: { runtime: Record<string, unknown>; content: Record<string, unknown> }) {
  if (published.runtime.features === undefined) return { definition, features: null };
  // Finalization appends nodes and activation groups to the lane's tree; the lane's own tree must be the published prefix.
  const tree = record(definition.tree, 'prepared tree'), previous = record(published.runtime.tree, 'published tree');
  const nodes = Array.isArray(tree.nodes) ? tree.nodes : [], previousNodes = Array.isArray(previous.nodes) ? previous.nodes : [];
  if (Object.entries(tree).some(([key, value]) => JSON.stringify(key === 'nodes' ? previousNodes.slice(0, nodes.length) : previous[key]) !== JSON.stringify(value))) throw new Error(`${id}: the scene tree differs from the published preparation, so its feature anchors cannot carry over; run the full preparation.`);
  return { definition: { ...definition, features: published.runtime.features },
    features: record(published.content.features, 'published feature content') as unknown as Parameters<typeof writeFeatureContent>[1] };
}

async function prepareAuthoredStages({ objectDirectory, publicDirectory, outputDirectory, write = false, replaceReviewedImages = false, presentationOnly = false }: AuthoredPreparationContext): Promise<AuthoredPreparationResult> {
  if (write) {
    const id = record(JSON.parse(await readFile(resolve(objectDirectory, 'object.json'), 'utf8')), 'descriptor').id;
    if (typeof id !== 'string' || !/^[a-z][a-z0-9-]*$/u.test(id)) throw new TypeError('Invalid preparation identity.');
    const projectRoot = process.cwd(), stageRoot = resolve(projectRoot, '.local/object-preparation');
    await mkdir(stageRoot, { recursive: true });
    const stage = await mkdtemp(resolve(stageRoot, `${id}-`));
    try {
      const stagedPublic = resolve(stage, 'public'), stagedData = resolve(stage, 'prepared');
      // The stage starts from the published set; publication verifies every carried image against the new manifest.
      if (presentationOnly) await Promise.all([cp(outputDirectory, stagedData, { recursive: true }), cp(publicDirectory, stagedPublic, { recursive: true })]);
      const result = await prepareAuthoredObject({ objectDirectory, publicDirectory: stagedPublic, outputDirectory: stagedData, replaceReviewedImages, presentationOnly });
      if (!result.definition) throw new TypeError('Preparation produced no runtime payload.');
      // Palette legend labels are derived from the stretch this run just measured: refresh them, repin, and prepare again.
      const legend = await stagedLegendLabelChanges(objectDirectory, stagedData);
      if (legend.changes.length) {
        if (process.env.CSSEARTH_PREPARATION_TRACE) throw new Error(`${id}: legend labels differ from the prepared stretch: ${legend.summary}.`);
        await writeFile(legend.contentPath, `${JSON.stringify(legend.refreshed, null, 2)}\n`);
        console.log(`refreshed legend labels ${legend.summary}`);
        return await prepareAuthoredStages({ objectDirectory, publicDirectory, outputDirectory, write, replaceReviewedImages, presentationOnly });
      }
      const { finalizeObjectJson } = await import(pathToFileURL(resolve(projectRoot, 'tools/prepare/prepare-object-json.mts')).href) as typeof import('../prepare/prepare-object-json.mts');
      const finalized = await finalizeObjectJson(id, result.definition, { projectRoot, objectDirectory, preparedDirectory: stagedData,
        descriptorPath: resolve(stage, 'object.json') }, { publicDirectory: stagedPublic });
      if (presentationOnly) {
        // The carried provenance describes the published images, so the run must publish exactly those images.
        const inventory = async (path: string) => JSON.stringify(JSON.parse(await readFile(path, 'utf8')));
        if (await inventory(resolve(stagedData, 'runtime-assets.json')) !== await inventory(resolve(objectDirectory, 'runtime-assets.json')))
          throw new Error(`${id}: the presentation changed the published image set; run the full preparation.`);
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
  if (presentationOnly && !source(sources, 'paged-ellipsoid')) throw new TypeError(`${descriptor.id}: presentation-only preparation is implemented for the paged-ellipsoid lane only.`);
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
    // A presentation-only run carries the published feature anchors; read them before the lane rewrites this directory.
    const publishedFeatures = presentationOnly ? {
      runtime: record(JSON.parse(await readFile(resolve(outputDirectory, 'runtime.json'), 'utf8')), 'published runtime'),
      content: record(JSON.parse(await readFile(resolve(outputDirectory, 'content.json'), 'utf8')), 'published content') } : null;
    const prepared = await preparePagedEllipsoidObject({ objectDirectory, publicDirectory, outputDirectory, prepareContent: prepareObjectContentAssets, presentationOnly });
    // Named features anchor on the rendered ellipsoid (attach.ts casts map directions through the lane's own surface sampler).
    const attached = publishedFeatures ? carryPublishedFeatures(descriptor.id, prepared.definition as unknown as Record<string, unknown>, publishedFeatures)
      : await attachSurfaceFeatures({ descriptor, sources, sourceDirectory, publicDirectory, outputDirectory, definition: prepared.definition as unknown as Record<string, unknown> });
    if (attached.features) { await writeFile(resolve(outputDirectory, 'runtime.json'), `${JSON.stringify(attached.definition)}\n`); await writeFeatureContent(outputDirectory, attached.features); }
    const definition = attached.definition as typeof prepared.definition;
    await prepareRuntimeManifest({ id: descriptor.id, publicRoot: publicDirectory,
      manifestPath: write ? resolve(objectDirectory, 'runtime-assets.json') : resolve(outputDirectory, 'runtime-assets.json'),
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
      manifestPath: write ? resolve(objectDirectory, 'runtime-assets.json') : resolve(outputDirectory, 'runtime-assets.json'),
      values: [prepared.raster, prepared.celestial, prepared.scene, prepared.definition, prepared.content] });
    if (write) await writePreparedObject(descriptor.id, prepared.definition);
    return Object.freeze({ ...prepared });
  }
  if (source(sources, 'shape-model')) {
    genericLaneOnly();
    const { prepareShapeModel } = await import(pathToFileURL(resolve(process.cwd(), 'tools/objects/shape-model/index.mts')).href) as typeof import('./shape-model/index.mts');
    const prepared = await prepareShapeModel({ descriptor, sources, objectDirectory, publicDirectory, outputDirectory, prepareContent: prepareObjectContentAssets });
    await prepareRuntimeManifest({ id: descriptor.id, publicRoot: publicDirectory, manifestPath: resolve(outputDirectory, 'runtime-assets.json'), allowPreparationArtifacts: true, values: [prepared.definition, prepared.content] });
    return Object.freeze({ descriptor, sources, ...prepared });
  }
  if (source(sources, 'terrestrial')) {
    const terrestrial = record(required(sources, 'terrestrial').value, 'terrestrial');
    if (Boolean(terrestrial.rings) !== Boolean(descriptor.recipe.rings)) throw new TypeError('Prepared terrestrial rings must match the authored capability.');
    const { prepareTerrestrialLayers } = await import(pathToFileURL(resolve(process.cwd(), 'tools/objects/terrestrial-layers/index.mts')).href) as typeof import('./terrestrial-layers/index.mts');
    const terrestrialPrepared = await prepareTerrestrialLayers({ sourceDirectory, publicDirectory, outputDirectory,
      config: terrestrial, prepareContent: prepareObjectContentAssets, replaceReviewedImages });
    const terrestrialAttached = await attachSurfaceFeatures({ descriptor, sources, sourceDirectory, publicDirectory, outputDirectory, definition: terrestrialPrepared.definition as unknown as Record<string, unknown> });
    if (terrestrialAttached.features) {
      await writeFile(resolve(outputDirectory, 'runtime.json'), `${JSON.stringify(terrestrialAttached.definition)}\n`);
      await writeFeatureContent(outputDirectory, terrestrialAttached.features);
    }
    const prepared = { ...terrestrialPrepared, definition: terrestrialAttached.definition as typeof terrestrialPrepared.definition };
    await prepareRuntimeManifest({ id: descriptor.id, publicRoot: publicDirectory,
      manifestPath: write ? resolve(objectDirectory, 'runtime-assets.json') : resolve(outputDirectory, 'runtime-assets.json'),
      allowPreparationArtifacts: true,
      values: [prepared.definition, prepared.content] });
    if (write) await writePreparedObject(descriptor.id, prepared.definition);
    return Object.freeze({ descriptor, sources, ...prepared });
  }
  // Scientific and observed surfaces are interpreted by their existing decoder owners (observation rasters,
  // terrestrial decoders, GLB base colour, solar synoptic maps) before the raster lane packs them; src never imports tools.
  const rasterConfig = parseRasterRecipe(required(sources, 'raster').value);
  const solarSource = physicalSolarSource(required(sources, 'solar-system').value);
  const { createSurfaceInterpreter } = await import(pathToFileURL(resolve(process.cwd(), 'tools/objects/observation/interpret.mts')).href) as typeof import('./observation/interpret.mts');
  const interpret = await createSurfaceInterpreter({ objectId: descriptor.id, displayName: solarSource.displayName, sourceDirectory, recipe: rasterConfig });
  const raster = await prepareRasterAssets({ sourceDirectory, publicDirectory, outputDirectory, config: rasterConfig, interpret });
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
  const celestial = await prepareCelestialAssets({ sourceDirectory, publicDirectory, outputDirectory, config: required(sources, 'celestial').value });
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
  const scene = await prepareGeometryScene({ profile: geometryConfig, raster: rasterConfig,
    assets: { ...(raster as unknown as GeometrySceneAssets), ...(Object.keys(ringWedges).length ? { ringWedges } : {}) }, solarSource, starfield: celestial.sky as unknown as Record<string, unknown>, sun: celestial.sun as unknown as Record<string, unknown> | null, ...(worldContext !== undefined ? { worldContext } : {}), adapters: await loadGeometryAdapters(), outputDirectory });
  const contentReference = required(sources, 'content');
  const content = await prepareObjectContentAssets({ sourceDirectory, publicDirectory, outputDirectory, config: { contentPath: relative(sourceDirectory, contentReference.path) } });
  validateCapabilityComposition(descriptor, rasterConfig as unknown as Record<string, unknown>, geometryConfig as unknown as Record<string, unknown>, solarSource, content.lenses);
  const presentation = parsePresentationProfile(required(sources, 'presentation').value);
  const definition = await prepareCssPresentation({ namespace: presentation.namespace, mode: presentation.mode, ...(presentation.lensFocus ? { lensFocus: presentation.lensFocus } : {}), scene: scene as unknown as PresentationInputs['scene'], assets: raster as unknown as PresentationInputs['assets'], lenses: content.lenses as unknown as PresentationInputs['lenses'], sun: celestial.sun as unknown as PresentationInputs['sun'], solarSource: solarSource as unknown as PresentationInputs['solarSource'], controls: content.controls as unknown as PresentationInputs['controls'] });
  const attached = await attachSurfaceFeatures({ descriptor, sources, sourceDirectory, publicDirectory, outputDirectory, definition: definition as unknown as Record<string, unknown> });
  const runtime = attached.definition, features = attached.features !== null;
  if (attached.features) await writeFeatureContent(outputDirectory, attached.features);
  await writeFile(resolve(outputDirectory, 'runtime.json'), `${JSON.stringify(runtime)}\n`);
  await prepareRuntimeManifest({ id: descriptor.id, publicRoot: publicDirectory,
    manifestPath: write ? resolve(objectDirectory, 'runtime-assets.json') : resolve(outputDirectory, 'runtime-assets.json'),
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
  if (!id || !/^[a-z][a-z0-9-]*$/u.test(id) || flags.some(flag => flag !== '--write' && flag !== '--presentation-only') || new Set(flags).size !== flags.length ||
      (flags.includes('--presentation-only') && !flags.includes('--write'))) throw new TypeError('Usage: prepare-authored <object-id> [--write [--presentation-only]].');
  const root = process.cwd(), write = flags.includes('--write'), presentationOnly = flags.includes('--presentation-only');
  const result = await prepareAuthoredObject({ objectDirectory: resolve(root, 'src/objects', id), publicDirectory: write ? resolve(root, 'public/scenes', id) : resolve(root, '.local/full-json-migration/staged-public', id), outputDirectory: write ? resolve(root, 'src/objects', id, 'prepared') : resolve(root, '.local/full-json-migration/staged', id), write, presentationOnly });
  if (!write) {
    // A check run refuses labels its own report contradicts; write mode rewrites them.
    const legend = await stagedLegendLabelChanges(resolve(root, 'src/objects', id), resolve(root, '.local/full-json-migration/staged', id));
    if (legend.changes.length) throw new Error(`${id}: legend labels differ from the prepared stretch: ${legend.summary}; run prepare-authored ${id} --write.`);
  }
  console.log(JSON.stringify({ id: result.descriptor.id, runtime: result.definition !== undefined }));
}
