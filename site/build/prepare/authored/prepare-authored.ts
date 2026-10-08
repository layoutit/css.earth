import { readFeatureMapLongitude, readPreparedPanelContentRecord, readComparableSource, readObjectDescriptorRecord, validatePreparedCubicSky, validateDirectionalSunPlan, parsePreparedObjectRuntime, readObjectContentDatasets, parseObjectDescriptor, RASTER_RECIPE_SCHEMA, parsePresentationProfile, AUTHORED_PREPARATION_SCHEMA, type AuthoredPreparationReceipt, readAuthoredPreparationSources, CANONICAL_PREPARED_IMAGE_DENSITY as RASTER_DENSITY, type AuthoredObjectDescriptor } from '@cssearth/objects';
import { requireInventory, readPreparedRuntimeText } from '@cssearth/objects/node';
import { BANDED_ELLIPSOID_SCHEMA, LAYERED_OBLATE_SCHEMA } from '@cssearth/bake/objects/scene';
import { readNonArrayRecord, isRecord } from '@cssearth/core';
import '@cssearth/bake/thread-pool';
import { execFileSync } from 'node:child_process';
import { access, cp, mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { relative, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import sharp from 'sharp';
import { readAuthoredSources, type VerifiedSource } from '@cssearth/bake/objects/sources';
import { readRasterRecipe, prepareLimb, prepareRasterAssets, surfaceCoordinateWidth, prepareLighting, prepareAtmosphere, outputName, LIGHTING_SHEET } from '@cssearth/bake/raster';
import { leafImageCandidates, parseGeometryProfile, prepareGeometryScene, widestLeafImages, type GeometrySceneAssets, type SolarSceneSource } from '@cssearth/bake/scene';
import { prepareCssPresentation, type PresentationInputs } from '@cssearth/bake/presentation';
import { prepareCelestialAssets } from '@cssearth/bake/objects/celestial';
import { checkGaiaCepheidModel, parseGaiaCepheidRow, pulsationTrack } from '@cssearth/bake/photometry';
import { assertDefaultViewFacesDataset } from '@cssearth/bake/objects/default-view';
import { prepareObjectContentAssets } from '../../content/prepare.ts';
import { loadGeometryAdapters, presentationHostAdapters } from '@cssearth/bake/objects/host-adapters';
import { prepareRuntimeManifest } from '@cssearth/bake/delivery';
import { prepareWorldNavigationDefinition, writeWorldNavigationArtifacts } from './prepare-world-navigation.ts';
import { worldFile } from '../world/world-files.mts';
import { attachSurfaceFeatures, longitudeDistanceDeg, measureAtlasLeftEdge, writeFeatureContent } from '@cssearth/bake/objects/surface-features';
import { loadNativePhotograph } from '@cssearth/bake/objects/layers/terrestrial';

export interface AuthoredPreparationContext { readonly objectDirectory: string; readonly publicDirectory: string; readonly outputDirectory: string; readonly write?: boolean;
  /** Write mode: regenerated reviewed images replace their source copies and pins instead of failing. */
  readonly replaceReviewedImages?: boolean;
  /** Reuse the published heavy outputs and prepare only the presentation; supported by the paged-ellipsoid lane. */
  readonly reuseImages?: boolean;
  /** Recipe sources the author states changed without feeding the reused outputs (reuse-images runs). */
  readonly acceptChanged?: readonly string[]; }
export interface AuthoredPreparationResult { readonly descriptor: AuthoredObjectDescriptor; readonly sources: ReadonlyMap<string, VerifiedSource>; readonly raster?: unknown; readonly celestial?: unknown; readonly scene?: unknown; readonly definition?: unknown;
  /** Public images a reuse-images run redrew from the recipe (the paged-ellipsoid material banks); they may change. */
  readonly recomputedImages?: readonly string[]; }
type Input = Record<string, unknown>;

function record(value: unknown, at: string): Input { return readNonArrayRecord(value, at, () => { throw new TypeError(`${at} must be an object.`); }); }
function source(sources: ReadonlyMap<string, VerifiedSource>, id: string): VerifiedSource | undefined { return sources.get(id); }
/** A star, a black hole or an emissive body is its own light, so it gets no directional Sun; every other body is lit by one. */
function litBySun(descriptor: AuthoredObjectDescriptor, presentation: unknown): boolean {
  const catalog = descriptor.properties.catalog, classification = isRecord(catalog) ? catalog.classification : undefined;
  return !(classification === 'star' || classification === 'black-hole' || parsePresentationProfile(presentation).mode === 'emissive');
}
function required(sources: ReadonlyMap<string, VerifiedSource>, id: string): VerifiedSource { const value = source(sources, id); if (!value) throw new TypeError(`Authored recipe requires ${id}.`); return value; }
function physicalSolarSource(value: unknown): SolarSceneSource {
  const input = record(value, 'solar-system source');
  if (typeof input.bodyId !== 'string' || typeof input.displayName !== 'string' || typeof input.bodyRadiusUnits !== 'number' || !(input.bodyRadiusUnits > 0) || typeof input.bodyRadiusKilometers !== 'number' || !(input.bodyRadiusKilometers > 0)) throw new TypeError('Solar-system source lacks physical scene parameters.');
  return Object.freeze({ ...input, bodyId: input.bodyId, displayName: input.displayName, bodyRadiusUnits: input.bodyRadiusUnits, bodyRadiusKilometers: input.bodyRadiusKilometers });
}
function ids(value: unknown, at: string): Set<string> { if (!Array.isArray(value) || value.some(item => !item || typeof item !== 'object' || typeof (item as Record<string, unknown>).id !== 'string')) throw new TypeError(`${at} needs identified records.`); return new Set(value.map(item => (item as Record<string, unknown>).id as string)); }
function sameIds(actual: Set<string>, expected: Set<string>, at: string): void { if (actual.size !== expected.size || [...actual].some(id => !expected.has(id))) throw new TypeError(`${at} does not match the authored capability declaration.`); }
function validateCapabilityComposition(descriptor: AuthoredObjectDescriptor, rasterConfig: Record<string, unknown>, geometryConfig: Record<string, unknown>, solar: SolarSceneSource, datasets: unknown): void {
  if (Math.abs(descriptor.recipe.shape.radiusKm - solar.bodyRadiusKilometers) > 1e-9) throw new TypeError('Authored shape radius differs from the physical source.');
  const materialSources = new Set(descriptor.recipe.materials?.map(item => item.source));
  if (materialSources.has('raster') && rasterConfig.lighting === undefined && rasterConfig.atmosphere === undefined && rasterConfig.emission === undefined) throw new TypeError('Authored material has no prepared raster backend.');
  if (Boolean(descriptor.recipe.emission) !== Boolean(rasterConfig.emission)) throw new TypeError('Authored emission and its prepared raster backend disagree.');
  if (Boolean(descriptor.recipe.cutaway) !== Boolean(rasterConfig.interior) || Boolean(descriptor.recipe.cutaway) !== Boolean(geometryConfig.cutaway)) throw new TypeError('Authored cutaway and its prepared geometry/assets disagree.');
  if (Boolean(descriptor.recipe.atmosphere) !== Boolean(rasterConfig.atmosphere)) throw new TypeError('Authored atmosphere and its prepared raster backend disagree.');
  const declared = new Set(descriptor.recipe.surfaces.flatMap(surface => surface.datasets.map(dataset => dataset.id)));
  // A dataset that names a companion cloud borrows a prepared surface instead of owning one, so it is not a surface
  // dataset and the recipe does not declare it. Its own contract check is that the surface it borrows exists.
  const controls = record(datasets, 'prepared datasets').controls as { id?: unknown; volume?: { surface?: unknown } }[];
  const surfaces = controls.filter(control => control.volume === undefined || control.volume.surface === control.id);
  const prepared = ids(surfaces, 'prepared datasets.controls');
  sameIds(prepared, declared, 'Prepared datasets');
  for (const control of controls) {
    if (control.volume === undefined) continue;
    if (!declared.has(String(control.volume.surface))) throw new TypeError(`Prepared dataset ${String(control.id)} borrows an unprepared surface.`);
  }
}
async function writePreparedObject(id: string, definition: Record<string, unknown>): Promise<void> {
  const module = record(await import(pathToFileURL(resolve(process.cwd(), 'site/build/prepare/authored/prepare-object-json.mts')).href), 'prepared object writer');
  const write = module.writeObjectJson;
  if (typeof write !== 'function') throw new TypeError('Prepared object writer is missing.');
  await (write as (objectId: string, runtime: Record<string, unknown>) => Promise<unknown>)(id, definition);
}

/** Verify authored source pins, then prepare each available generic capability lane. */
export async function prepareAuthoredObject({ objectDirectory, publicDirectory, outputDirectory, write = false, replaceReviewedImages = write, reuseImages = false, acceptChanged = [] }: AuthoredPreparationContext): Promise<AuthoredPreparationResult> {
  const result = await prepareAuthoredStages({ objectDirectory, publicDirectory, outputDirectory, write, replaceReviewedImages, reuseImages, acceptChanged });
  if (write || !result.definition) return result;
  const { prepareSurfaceMinimaps } = await import('@cssearth/bake/surface-previews');
  // Minimaps render from the raw imagery; a reuse-images stage already carries the published ones. An object with no
  // surface has no map to draw.
  const surfaced = result.descriptor.recipe.surfaces.length > 0;
  if (!reuseImages && surfaced) await prepareSurfaceMinimaps({ objectDirectory, publicDirectory, outputDirectory, solarGeometry: await solarGeometry() });
  if (!reuseImages && surfaced) await assertMapsStartAtSurfaceMapEdge(objectDirectory, outputDirectory);
  const prepared = await prepareWorldNavigationDefinition({ objectDirectory, definition: result.definition as Record<string, unknown> });
  await assertDefaultViewsFaceDatasets(objectDirectory, prepared.definition as Record<string, unknown>, prepared.frame);
  const scene = await writeWorldNavigationArtifacts(outputDirectory, prepared, result.scene as Record<string, unknown> | undefined);
  return Object.freeze({ ...result, definition: prepared.definition, scene });
}

/** Each photograph dataset's prepared map must start where the surface map says. The dataset's own georeferenced source is read at
 * true east longitudes and correlated with its prepared minimap (rolled by the minimap framing) at every candidate left edge;
 * a map whose best edge is not the declared one is drawn away from its frame, as Iapetus and Ganymede were half a turn. */
export async function assertMapsStartAtSurfaceMapEdge(objectDirectory: string, outputDirectory: string): Promise<void> {
  const { descriptor, sources, manifest } = await readAuthoredSources(objectDirectory);
  const surfaceMap = (source(sources, 'features')?.value as { surfaceMap?: unknown } | undefined)?.surfaceMap;
  const surfaces = (source(sources, 'raster')?.value as { surfaces?: unknown } | undefined)?.surfaces;
  if (typeof surfaceMap !== 'string' || !Array.isArray(surfaces)) return;
  const surfaceMapPath = resolve(objectDirectory, 'source', surfaceMap);
  const edge = record(JSON.parse(await readFile(surfaceMapPath, 'utf8')) as unknown, 'surface map').mapLeftEdgeLongitudeDeg;
  if (typeof edge !== 'number' || !Number.isFinite(edge)) throw new TypeError(`${descriptor.id}: ${surfaceMapPath} mapLeftEdgeLongitudeDeg is ${String(edge)}, not a number.`);
  const framing = await readFile(resolve(objectDirectory, 'source/presentation/minimap.json'), 'utf8').then(text => (JSON.parse(text) as { centerLongitudeDegrees?: unknown }).centerLongitudeDegrees, () => undefined);
  // prepare-surface-minimaps rolls a framed minimap so its left edge is map longitude (center - 180).
  const minimapEdge = ((edge + (typeof framing === 'number' ? framing - 180 : 0)) % 360 + 360) % 360;
  const minimaps = record(JSON.parse(await readFile(resolve(outputDirectory, 'minimaps.json'), 'utf8')) as unknown, 'minimaps').images;
  for (const value of surfaces) {
    const surface = record(value, 'raster surface'), science = surface.science === undefined ? undefined : record(surface.science, `${String(surface.id)} science`);
    if (science?.kind !== 'terrestrial-observation' || !science.nativePhotographicSampling) continue;
    const input = manifest.manifest.inputs.find(entry => entry.id === science.input);
    const image = Array.isArray(minimaps) ? minimaps.map(entry => record(entry, 'minimap')).find(entry => entry.id === surface.id) : undefined;
    if (!input || typeof image?.path !== 'string') continue;
    const photograph = await loadNativePhotograph(resolve(objectDirectory, 'source'), input, science.validity);
    const { data, info } = await sharp(resolve(outputDirectory, image.path)).removeAlpha().greyscale().raw().toBuffer({ resolveWithObject: true });
    const color = [0, 0, 0];
    const measured = measureAtlasLeftEdge((longitude, latitude) => photograph.sample(longitude, latitude, color) ? (color[0]! + color[1]! + color[2]!) / 3 : null,
      { data, width: info.width, height: info.height }, minimapEdge);
    if (longitudeDistanceDeg(measured.edgeDeg, minimapEdge) > 4 && measured.correlation - measured.expectedCorrelation > 0.2) {
      const actual = ((measured.edgeDeg - (minimapEdge - edge)) % 360 + 360) % 360;
      throw new Error(`${descriptor.id}/${String(surface.id)}: the prepared map starts at ${actual}° E, but ${relative(process.cwd(), surfaceMapPath)} declares mapLeftEdgeLongitudeDeg ${edge}. `
        + `Its source correlates ${measured.correlation.toFixed(2)} with the minimap read from ${measured.edgeDeg}° E and ${measured.expectedCorrelation.toFixed(2)} read from ${minimapEdge}° E, where the declared edge and the minimap framing put it (${measured.samples} source samples).`);
    }
  }
}

/** Legend labels of the object's content record against the stretch a staged or checked run reported (`@cssearth/bake/objects/content`). */
export async function stagedLegendLabelChanges(objectDirectory: string, preparedDirectory: string) {
  const { legendLabelChanges, withDerivedLegendLabels } = await import('@cssearth/bake/objects/content');
  const { descriptor } = await readAuthoredSources(objectDirectory);
  const contentReference = descriptor.recipe.sources.find(entry => entry.id === 'content');
  const assets = await readFile(resolve(preparedDirectory, 'assets.json'), 'utf8').catch(() => null);
  if (!contentReference || assets === null) return { changes: [], summary: '', contentPath: '', refreshed: null };
  const contentPath = resolve(objectDirectory, contentReference.path), content = readObjectContentDatasets(JSON.parse(await readFile(contentPath, 'utf8')));
  const changes = legendLabelChanges(content, JSON.parse(assets) as unknown);
  return { changes, contentPath, refreshed: withDerivedLegendLabels(content, changes),
    summary: changes.map(change => `${change.datasetId} ${JSON.stringify(change.authored)} -> ${JSON.stringify(change.derived)}`).join('; ') };
}

/** The generated solar geometry, read from the checkout at run time: it is written after the packages build, so the bake takes it as a
 * parameter. The generated module satisfies the preparers' contracts as it is; typing it by the module keeps drift a type error. */
const solarGeometry = async () =>
  await import(pathToFileURL(resolve(process.cwd(), 'src/platform/solar-geometry.mts')).href) as typeof import('../../../../src/platform/solar-geometry.mts');

/** A photograph dataset states the body point its frame looks at; the default camera must look there too (@cssearth/bake/objects/default-view). The check
 * reads the final frame, which follows the body as drawn. */
async function assertDefaultViewsFaceDatasets(objectDirectory: string, definition: Record<string, unknown>, frame: unknown): Promise<void> {
  const { descriptor, sources } = await readAuthoredSources(objectDirectory);
  const raster = source(sources, 'raster')?.value as { surfaces?: { science?: { kind?: string; dataset?: unknown } }[] } | undefined;
  for (const surface of raster?.surfaces ?? []) {
    const science = surface.science;
    if (!science || science.kind !== 'surface-observation') continue;
    const frames = record(science.dataset, 'surface-observation dataset').frames;
    const datasetFrame = Array.isArray(frames) && frames.length === 1 ? record(frames[0], 'dataset frame') : null;
    if (!datasetFrame || typeof datasetFrame.observerWestLongitude !== 'number' || typeof datasetFrame.observerLatitude !== 'number') continue;
    assertDefaultViewFacesDataset(await solarGeometry(), descriptor.id, definition.camera as never, frame as never, { longitudeDegrees: -datasetFrame.observerWestLongitude, latitudeDegrees: datasetFrame.observerLatitude });
  }
}

/** Feature anchors address scene-tree nodes, so they carry over only while the tree keeps the published node topology. A node's
 * style and the shared declaration table may change (a leaf's raster size, say) without moving any node. When nodes move
 * (a removed dataset's cutaway), `null` asks the caller to anchor them afresh: that reads only tracked JSON and the scene. */
function carryPublishedFeatures(definition: Record<string, unknown>, published: { runtime: Record<string, unknown>; content: Record<string, unknown> }) {
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
  if (Object.entries(tree).some(differs)) return null;
  return { definition: { ...definition, features: published.runtime.features },
    features: record(published.content.features, 'published feature content') as unknown as Parameters<typeof writeFeatureContent>[1] };
}

async function prepareAuthoredStages({ objectDirectory, publicDirectory, outputDirectory, write = false, replaceReviewedImages = false, reuseImages = false, acceptChanged = [] }: AuthoredPreparationContext): Promise<AuthoredPreparationResult> {
  if (write) {
    const id = record(parseObjectDescriptor(JSON.parse(await readFile(resolve(objectDirectory, 'object.json'), 'utf8'))), 'descriptor').id;
    if (typeof id !== 'string' || !/^[a-z][a-z0-9-]*$/u.test(id)) throw new TypeError('Invalid preparation identity.');
    const projectRoot = process.cwd(), stageRoot = resolve(projectRoot, '.local/object-preparation');
    await mkdir(stageRoot, { recursive: true });
    // Publication refuses files the inventory does not list; say so before the run, not after it.
    const { unownedPreparedFiles, unownedPublicFiles } = await import('@cssearth/bake/delivery');
    // The pins after this run inventory everything under prepared/, so a leftover there would be published. The world's own files are
    // the world step's: it writes and pins them (pin-world-files.mts).
    const leftovers = await unownedPreparedFiles(id, objectDirectory, outputDirectory, worldFile);
    if (leftovers.length) throw new Error(`${id}: ${relative(projectRoot, outputDirectory)} holds ${leftovers.length} file(s) inventory.json does not list (${leftovers.slice(0, 5).join(', ')}${leftovers.length > 5 ? ', ...' : ''}): leftovers of an earlier preparation, which this run would publish. Delete them and run again.`);
    const strays = await unownedPublicFiles(id, objectDirectory, publicDirectory);
    if (strays.length) throw new Error(`${id}: ${relative(projectRoot, publicDirectory)} holds ${strays.length} file(s) inventory.json does not list (${strays.slice(0, 5).join(', ')}${strays.length > 5 ? ', ...' : ''}); publication would refuse them. Move them out of that directory and run again.`);
    const stage = await mkdtemp(resolve(stageRoot, `${id}-`));
    try {
      const stagedPublic = resolve(stage, 'public'), stagedData = resolve(stage, 'prepared');
      // The stage starts from the published set; publication verifies every carried image against the new manifest.
      // Only inventoried files are carried: a local leftover in prepared/ or site/public/ must not be published with them.
      if (reuseImages) {
        const inventoried = new Map<string, Set<string>>();
        for (const asset of requireInventory(id, JSON.parse(await readFile(resolve(objectDirectory, 'inventory.json'), 'utf8'))).assets)
          (inventoried.get(asset.location) ?? inventoried.set(asset.location, new Set()).get(asset.location)!).add(asset.filename);
        const published = (location: string, root: string) => (path: string) => {
          const name = relative(root, path), names = inventoried.get(location) ?? new Set<string>();
          return path === root || names.has(name) || [...names].some(file => file.startsWith(`${name}/`));
        };
        await Promise.all([cp(outputDirectory, stagedData, { recursive: true, filter: published('prepared', outputDirectory) }),
          cp(publicDirectory, stagedPublic, { recursive: true, filter: published('public', publicDirectory) })]);
      }
      else {
        // The arrival billboard belongs to navigation, not to this bake: a full run carries the published record and the image it
        // names, or the page that the billboard step photographs could not start without them (packages/bake/cli/prepare-arrival-billboard.mts).
        const record: unknown = await readFile(resolve(outputDirectory, 'arrival-billboard.json'), 'utf8').then(text => JSON.parse(text) as unknown, () => null);
        // Only while it still shows the default dataset: a billboard of a replaced dataset is stale, and the billboard step makes the new one.
        const content = readObjectContentDatasets(JSON.parse(await readFile(resolve(objectDirectory, 'source/content/object.json'), 'utf8'))) as { datasets?: { defaultDataset?: unknown } };
        const current = record && typeof record === 'object' && 'dataset' in record && record.dataset === content.datasets?.defaultDataset;
        const url = current && 'url' in record && typeof record.url === 'string' ? record.url : null;
        const image = url?.startsWith(`/scenes/${id}/`) ? url.slice(`/scenes/${id}/`.length) : null;
        if (image && await access(resolve(publicDirectory, image)).then(() => true, () => false)) {
          await mkdir(stagedPublic, { recursive: true }); await mkdir(stagedData, { recursive: true });
          await Promise.all([cp(resolve(outputDirectory, 'arrival-billboard.json'), resolve(stagedData, 'arrival-billboard.json')), cp(resolve(publicDirectory, image), resolve(stagedPublic, image))]);
        }
      }
      const result = await prepareAuthoredObject({ objectDirectory, publicDirectory: stagedPublic, outputDirectory: stagedData, replaceReviewedImages, reuseImages, acceptChanged });
      if (!result.definition) throw new TypeError('Preparation produced no runtime payload.');
      // Palette legend labels are derived from the stretch this run just measured: refresh them, repin, and prepare again.
      const legend = await stagedLegendLabelChanges(objectDirectory, stagedData);
      if (legend.changes.length) {
        await writeFile(legend.contentPath, `${JSON.stringify(legend.refreshed, null, 2)}\n`);
        console.log(`refreshed legend labels ${legend.summary}`);
        return await prepareAuthoredStages({ objectDirectory, publicDirectory, outputDirectory, write, replaceReviewedImages, reuseImages, acceptChanged });
      }
      const { finalizeObjectJson } = await import(pathToFileURL(resolve(projectRoot, 'site/build/prepare/authored/prepare-object-json.mts')).href) as typeof import('./prepare-object-json.mts');
      const finalized = await finalizeObjectJson(id, result.definition, { projectRoot, objectDirectory, preparedDirectory: stagedData,
        descriptorPath: resolve(stage, 'object.json') }, { publicDirectory: stagedPublic });
      if (reuseImages) {
        // Charts are regenerated by content preparation,
        // so their declared SVG outputs may change; all other published images must remain byte-identical.
        // Public JSON catalogues (places, features) are derived from the scene and may be regenerated here.
        // The staged inventory holds the run's public entries; the object's also holds its prepared entries.
        const published = async (path: string) => requireInventory(id, JSON.parse(await readFile(path, 'utf8'))).assets
          .filter(asset => asset.location === 'public' && !asset.filename.endsWith('.json'));
        const stagedImages = await published(resolve(stagedData, 'inventory.json'));
        const existingImages = await published(resolve(objectDirectory, 'inventory.json'));
        if (JSON.stringify(stagedImages) !== JSON.stringify(existingImages)) {
          const existing = new Map(existingImages.map(asset => [asset.filename, asset]));
          const staged = new Map(stagedImages.map(asset => [asset.filename, asset]));
          const changed = [...new Set([...existing.keys(), ...staged.keys()])].filter(filename => JSON.stringify(existing.get(filename)) !== JSON.stringify(staged.get(filename)));
          const chartSource = result.sources.get('charts')?.value as { charts?: { output?: unknown }[] } | undefined;
          const chartOutputs = new Set(chartSource?.charts?.map(chart => chart.output).filter((output): output is string => typeof output === 'string' && output.endsWith('.svg')) ?? []);
          // The lighting and atmosphere stages are recomputed from their recipes, so their images may change. The lighting
          // stage writes the sheet and the flood-lit frame (lighting-sheet.ts), which a published set may predate.
          const rasterRecipe = result.sources.get('raster')?.value as { lighting?: Record<string, unknown>; atmosphere?: Record<string, unknown> } | undefined;
          const lighting = new Set<string>(rasterRecipe?.lighting ? [LIGHTING_SHEET.sheetFile, LIGHTING_SHEET.shadowlessFile] : []);
          const pattern = (name: string) => new RegExp(`^${name.replace(/[.*+?^${}()|[\]\\]/gu, '\\$&')}$`, 'u');
          const recomputed = [...(result.recomputedImages ?? []), ...Object.entries(rasterRecipe?.atmosphere ?? {})
            .filter(([key, value]) => key.endsWith('Output') && typeof value === 'string').map(([, value]) => outputName(value as string, RASTER_DENSITY))].map(pattern);
          const redrawn = (filename: string) => recomputed.some(output => output.test(filename));
          // A removed dataset drops its images: the run may leave published images out, never add or change others.
          const removed = (filename: string) => existing.has(filename) && !staged.has(filename);
          const unexpected = changed.filter(filename => !chartOutputs.has(filename) && !removed(filename) && !lighting.has(filename) && !(redrawn(filename) && existing.has(filename) && staged.has(filename)));
          if (unexpected.length || !changed.length)
            throw new Error(`${id}: the presentation changed the published image set (${unexpected.join(', ') || 'order only'}); run the full preparation.`);
        }
      }
      const { publishPreparedObject } = await import('@cssearth/bake/delivery');
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
  const genericRasterLane = (source(sources, 'raster')?.value as Record<string, unknown> | undefined)?.schema === RASTER_RECIPE_SCHEMA &&
    !['terrestrial', 'shape-model'].some(id => source(sources, id)) &&
    ![LAYERED_OBLATE_SCHEMA, BANDED_ELLIPSOID_SCHEMA].includes(String((source(sources, 'geometry')?.value as Record<string, unknown> | undefined)?.schema));
  if (reuseImages && !source(sources, 'paged-ellipsoid') && !genericRasterLane) throw new TypeError(`${descriptor.id}: --reuse-images supports the paged-ellipsoid and raster lanes only.`);
  const genericLaneOnly = () => { if (descriptor.recipe.features) throw new TypeError('Surface features are prepared by the generic authored lane only.'); };
  await mkdir(outputDirectory, { recursive: true });
  const sourceDirectory = resolve(objectDirectory, 'source');
  if (!descriptor.recipe.surfaces.length) {
    // No surface to bake: the scene is the camera, sky and world frame, and its datasets show companion banks.
    const { prepareSurfacelessScene, companionThumbnails } = await import('./surfaceless-scene.ts');
    // Each dataset's thumbnail is a picture of the bank it shows, published as the object's own file.
    await companionThumbnails({ objectDirectory, publicDirectory, content: required(sources, 'content').value });
    const content = await prepareObjectContentAssets({ sourceDirectory, publicDirectory, outputDirectory, config: { contentPath: relative(sourceDirectory, required(sources, 'content').path) } });
    const prepared = await prepareSurfacelessScene({ source: physicalSolarSource(required(sources, 'solar-system').value), controls: content.controls as never, solarGeometry: await solarGeometry() as never });
    await writeFile(resolve(outputDirectory, 'runtime.json'), `${JSON.stringify(prepared.definition)}\n`);
    await prepareRuntimeManifest({ id: descriptor.id, publicRoot: publicDirectory, objectDirectory: write ? objectDirectory : outputDirectory,
      preparedDirectory: outputDirectory, values: [prepared.definition, content] });
    if (write) await writePreparedObject(descriptor.id, prepared.definition as unknown as Record<string, unknown>);
    return Object.freeze({ descriptor, sources, definition: prepared.definition, scene: prepared.scene }) as never;
  }
  if ((source(sources, 'geometry')?.value as Record<string, unknown> | undefined)?.schema === LAYERED_OBLATE_SCHEMA) {
    genericLaneOnly();
    const { prepareLayeredOblateObject } = await import('@cssearth/bake/objects/layers/material-composition');
    return prepareLayeredOblateObject({ objectDirectory, publicDirectory, outputDirectory, write, prepareContent: prepareObjectContentAssets });
  }
  if (source(sources, 'paged-ellipsoid')) {
    const { preparePagedEllipsoidObject } = await import('@cssearth/bake/objects/layers/paged-ellipsoid');
    // A reuse-images run carries the published feature anchors; read them before the lane rewrites this directory.
    const publishedFeatures = reuseImages ? {
      runtime: record(parsePreparedObjectRuntime(JSON.parse(await readPreparedRuntimeText(outputDirectory)), { parsedJson: true }), 'published runtime'),
      content: readPreparedPanelContentRecord(JSON.parse(await readFile(resolve(outputDirectory, 'content.json'), 'utf8'))) } : null;
    const prepared = await preparePagedEllipsoidObject({ objectDirectory, publicDirectory, outputDirectory, prepareContent: prepareObjectContentAssets,
      solarGeometry: await solarGeometry(), assetWorker: pathToFileURL(resolve(process.cwd(), 'packages/bake/cli/paged-ellipsoid-asset-worker.mts')), reuseImages, acceptChanged });
    // Named features anchor on the rendered ellipsoid (attach.ts casts map directions through the lane's own surface sampler).
    const attached = (publishedFeatures && carryPublishedFeatures(prepared.definition as unknown as Record<string, unknown>, publishedFeatures))
      ?? await attachSurfaceFeatures({ descriptor, sources, sourceDirectory, publicDirectory, outputDirectory, definition: prepared.definition as unknown as Record<string, unknown> });
    if (attached.features) { await writeFile(resolve(outputDirectory, 'runtime.json'), `${JSON.stringify(attached.definition)}\n`); await writeFeatureContent(outputDirectory, attached.features); }
    const definition = attached.definition as typeof prepared.definition;
    await prepareRuntimeManifest({ id: descriptor.id, publicRoot: publicDirectory,
      objectDirectory: write ? objectDirectory : outputDirectory,
      preparedDirectory: outputDirectory,
      allowPreparationArtifacts: true,
      values: [definition, prepared.content] });
    if (write) await writePreparedObject(descriptor.id, definition);
    return Object.freeze({ ...prepared, definition });
  }
  if ((source(sources, 'geometry')?.value as Record<string, unknown> | undefined)?.schema === BANDED_ELLIPSOID_SCHEMA) {
    genericLaneOnly();
    const { prepareLayeredGiantObject } = await import('@cssearth/bake/objects/layers/giant');
    const prepared = await prepareLayeredGiantObject({ objectDirectory, publicDirectory, outputDirectory, prepareContent: prepareObjectContentAssets });
    await prepareRuntimeManifest({ id: descriptor.id, publicRoot: publicDirectory,
      objectDirectory: write ? objectDirectory : outputDirectory,
      preparedDirectory: outputDirectory,
      values: [prepared.raster, prepared.celestial, prepared.scene, prepared.definition, prepared.content] });
    if (write) await writePreparedObject(descriptor.id, prepared.definition);
    return Object.freeze({ ...prepared });
  }
  if (source(sources, 'shape-model')) {
    genericLaneOnly();
    const { prepareShapeModel } = await import('@cssearth/bake/objects/layers/shape-model');
    const prepared = await prepareShapeModel({ descriptor, sources, objectDirectory, publicDirectory, outputDirectory, prepareContent: prepareObjectContentAssets, solarGeometry: await solarGeometry() });
    await prepareRuntimeManifest({ id: descriptor.id, publicRoot: publicDirectory, objectDirectory: outputDirectory, preparedDirectory: outputDirectory, allowPreparationArtifacts: true, values: [prepared.definition, prepared.content] });
    return Object.freeze({ descriptor, sources, ...prepared });
  }
  if (source(sources, 'terrestrial')) {
    const terrestrial = record(required(sources, 'terrestrial').value, 'terrestrial');
    if (Boolean(terrestrial.rings) !== Boolean(descriptor.recipe.rings)) throw new TypeError('Prepared terrestrial rings must match the authored capability.');
    const { prepareTerrestrialLayers } = await import('@cssearth/bake/objects/layers/terrestrial');
    const terrestrialPrepared = await prepareTerrestrialLayers({ sourceDirectory, publicDirectory, outputDirectory,
      config: terrestrial, prepareContent: prepareObjectContentAssets, replaceReviewedImages, shape: descriptor.recipe.shape, solarGeometry: await solarGeometry() });
    const terrestrialAttached = await attachSurfaceFeatures({ descriptor, sources, sourceDirectory, publicDirectory, outputDirectory, definition: terrestrialPrepared.definition as unknown as Record<string, unknown> });
    if (terrestrialAttached.features) await writeFeatureContent(outputDirectory, terrestrialAttached.features);
    // Triangle faces also publish atlases masked to their triangles, for browsers without corner-shape.
    const { prepareTriangleAlphaAtlases } = await import('@cssearth/bake/objects/layers/terrestrial');
    const terrestrialDefinition = await prepareTriangleAlphaAtlases(terrestrialAttached.definition as never, { namespace: descriptor.id, publicDirectory, publicBase: `/scenes/${descriptor.id}/` });
    await writeFile(resolve(outputDirectory, 'runtime.json'), `${JSON.stringify(terrestrialDefinition)}\n`);
    const prepared = { ...terrestrialPrepared, definition: terrestrialDefinition as typeof terrestrialPrepared.definition };
    await prepareRuntimeManifest({ id: descriptor.id, publicRoot: publicDirectory,
      objectDirectory: write ? objectDirectory : outputDirectory,
      preparedDirectory: outputDirectory,
      allowPreparationArtifacts: true,
      values: [prepared.definition, prepared.content] });
    if (write) await writePreparedObject(descriptor.id, prepared.definition);
    return Object.freeze({ descriptor, sources, ...prepared });
  }
  // Scientific and observed surfaces are interpreted by their existing decoder owners (observation rasters,
  // terrestrial decoders, GLB base color, solar synoptic maps) before the raster lane packs them; src never imports tools.
  const rasterConfig = readRasterRecipe(required(sources, 'raster').value);
  const solarSource = physicalSolarSource(required(sources, 'solar-system').value);
  if (reuseImages && (source(sources, 'observations') || source(sources, 'rings')))
    throw new TypeError(`${descriptor.id}: --reuse-images cannot carry observed surfaces or radial layers, which publish their own images; run the full preparation.`);
  // With --reuse-images the published image metadata, sky and Sun stand in for the stages that read raw downloads; the
  // published features are read here, before the lane rewrites this directory.
  const publishedJson = async (name: string) => JSON.parse(await readFile(resolve(outputDirectory, `${name}.json`), 'utf8')) as unknown;
  const publishedFeatures = reuseImages ? { runtime: record(parsePreparedObjectRuntime(await publishedJson('runtime')), 'published runtime'),
    content: readPreparedPanelContentRecord(await publishedJson('content')) } : null;
  const reused = reuseImages ? record(await publishedJson('assets'), 'published raster assets') as unknown as Awaited<ReturnType<typeof prepareRasterAssets>> : null;
  // Lighting and atmosphere frames come from the recipe and the body's photometry, never from raw downloads, so a reuse run
  // recomputes them (a shared bank's are copied): the published metadata may predate a lighting output or a limb law.
  const surfaceShape = parseGeometryProfile(required(sources, 'geometry').value).surface;
  const shape = { polarToEquatorial: surfaceShape.polarRadius / surfaceShape.radius };
  if (reused && (rasterConfig.lighting || rasterConfig.atmosphere)) {
    if (rasterConfig.lighting) {
      const limb = rasterConfig.lighting.limb ? await prepareLimb(rasterConfig.lighting.limb, sourceDirectory, publicDirectory, rasterConfig, 'lighting.limb', shape.polarToEquatorial) : undefined;
      Object.assign(reused, { lighting: await prepareLighting(rasterConfig, rasterConfig.lighting, publicDirectory, limb) });
    }
    if (rasterConfig.atmosphere) {
      const limb = await prepareLimb(rasterConfig.atmosphere.limb, sourceDirectory, publicDirectory, rasterConfig, 'atmosphere.limb', shape.polarToEquatorial);
      Object.assign(reused, { atmosphere: await prepareAtmosphere(rasterConfig.atmosphere, sourceDirectory, publicDirectory, limb) });
    }
    await writeFile(resolve(outputDirectory, 'assets.json'), `${JSON.stringify(reused)}\n`);
  }
  const raster = reused ?? await prepareRasterAssets({ sourceDirectory, publicDirectory, outputDirectory, config: rasterConfig, shape,
      interpret: await (await import('@cssearth/bake/objects/interpretation'))
        .createSurfaceInterpreter({ objectId: descriptor.id, displayName: solarSource.displayName, sourceDirectory, recipe: rasterConfig, solarGeometry: await solarGeometry() }) });
  // A body may take its surfaces from an observed-surfaces recipe rather than this lane, which then prepares only its
  // lighting bank. The observed products are published beside it and the datasets name them, as they name any other surface.
  const observationsSource = source(sources, 'observations');
  const observed = observationsSource
    ? await (await import('@cssearth/bake/objects/layers/observed-surfaces'))
        .prepareObservedSurfaces({ sourceDirectory, publicDirectory, config: observationsSource.value, write: true })
    : null;
  // A body may also declare radial layers, such as a ring, whose image this lane publishes beside the surfaces; the
  // geometry profile places it as a plane.
  const ringsSource = source(sources, 'rings');
  const radial = ringsSource
    ? await (await import('@cssearth/bake/objects/layers/giant'))
        .prepareGiantLayers({ sourceDirectory, publicDirectory, config: ringsSource.value, write: true })
    : null;
  const celestial = reuseImages
    // The published runtime carries the sky and the Sun; sky.json and sun.json are this bake's working copies of them
    // (packages/objects/src/node/prepared-delivery.ts) and a restored checkout has neither.
    ? { sky: validatePreparedCubicSky(publishedFeatures!.runtime.sky), sun: readPublishedSun(publishedFeatures!.runtime.sun) } as unknown as Awaited<ReturnType<typeof prepareCelestialAssets>>
    : await prepareCelestialAssets({ sourceDirectory, publicDirectory, outputDirectory, directionalSun: litBySun(descriptor, required(sources, 'presentation').value),
      solarGeometry: await solarGeometry() });
  const geometryConfig = parseGeometryProfile(required(sources, 'geometry').value);
  // Rings the radial lane drew as wedges tell the scene where each ring begins, by the atlas the geometry names.
  const ringWedges = Object.fromEntries((radial?.assets ?? []).flatMap(asset => 'wedges' in asset && asset.wedges ? [[asset.filename, asset.wedges] as const] : []));
  // The datasets name every image a leaf can show, so content is prepared before the scene sizes its leaves.
  const contentReference = required(sources, 'content');
  const content = await prepareObjectContentAssets({ sourceDirectory, publicDirectory, outputDirectory, config: { contentPath: relative(sourceDirectory, contentReference.path) } });
  // Each leaf holds the widest image it can show at two texels per CSS pixel, measured from the files this run published.
  const imagePixels = await widestLeafImages(descriptor.id, leafImageCandidates({ objectId: descriptor.id, profile: geometryConfig, raster: rasterConfig,
    datasets: content.datasets, interior: raster.interior }), async url => {
    if (!url.startsWith(rasterConfig.publicBase)) throw new TypeError(`${descriptor.id}: leaf image ${url} is not under ${rasterConfig.publicBase}.`);
    const path = resolve(publicDirectory, url.slice(rasterConfig.publicBase.length));
    const { width } = await sharp(path).metadata().catch((error: unknown) => { throw new Error(`${descriptor.id}: leaf image ${url} (${path}) cannot be measured.`, { cause: error }); });
    return surfaceCoordinateWidth(raster, url, width ?? Number.NaN);
  });
  const scene = await prepareGeometryScene({ profile: geometryConfig, raster: rasterConfig,
    assets: { ...(raster as unknown as GeometrySceneAssets), ...(Object.keys(ringWedges).length ? { ringWedges } : {}) }, solarSource, starfield: celestial.sky as unknown as Record<string, unknown>, sun: celestial.sun as unknown as Record<string, unknown> | null, adapters: await loadGeometryAdapters(await solarGeometry()), outputDirectory, imagePixels });
  validateCapabilityComposition(descriptor, rasterConfig as unknown as Record<string, unknown>, geometryConfig as unknown as Record<string, unknown>, solarSource, content.datasets);
  const presentation = parsePresentationProfile(required(sources, 'presentation').value);
  // A pulsating star plays its published light curve from the scene epoch: Gaia's model, checked against its own row.
  const lightCurve = presentation.lightCurve ? await (async (path: string) => {
    const where = `${descriptor.id}: ${path}`, model = parseGaiaCepheidRow(await readFile(resolve(sourceDirectory, path), 'utf8'), where);
    const track = pulsationTrack(model, checkGaiaCepheidModel(model, where), Number((scene.worldFrame as { epochJdTt?: unknown } | null)?.epochJdTt), path, where);
    // The datasets of the step group the profile names are stills of the same light curve: the veil is not drawn over them.
    const group = presentation.lightCurve!.stills, stills = group === undefined ? [] : content.datasets.controls.filter(control => (control.step as { group?: unknown } | undefined)?.group === group).map(control => control.id);
    if (group !== undefined && !stills.length) throw new TypeError(`${where}: the presentation names the step group ${group} as the light curve's stills, and no dataset is a step of it.`);
    return stills.length ? { ...track, stills } : track;
  })(presentation.lightCurve.model) : undefined;
  const definition = await prepareCssPresentation({ namespace: presentation.namespace, mode: presentation.mode, ...(presentation.datasetFocus ? { datasetFocus: presentation.datasetFocus } : {}), ...(lightCurve ? { lightCurve } : {}), scene: scene as unknown as PresentationInputs['scene'], assets: raster as unknown as PresentationInputs['assets'], datasets: content.datasets as unknown as PresentationInputs['datasets'], sun: celestial.sun as unknown as PresentationInputs['sun'], solarSource: solarSource as unknown as PresentationInputs['solarSource'], controls: content.controls as unknown as PresentationInputs['controls'] }, presentationHostAdapters(await solarGeometry()));
  const attached = (publishedFeatures && carryPublishedFeatures(definition as unknown as Record<string, unknown>, publishedFeatures))
    ?? await attachSurfaceFeatures({ descriptor, sources, sourceDirectory, publicDirectory, outputDirectory, definition: definition as unknown as Record<string, unknown> });
  const runtime = attached.definition, features = attached.features !== null;
  if (attached.features) await writeFeatureContent(outputDirectory, attached.features);
  await writeFile(resolve(outputDirectory, 'runtime.json'), `${JSON.stringify(runtime)}\n`);
  await prepareRuntimeManifest({ id: descriptor.id, publicRoot: publicDirectory,
    objectDirectory: write ? objectDirectory : outputDirectory,
    preparedDirectory: outputDirectory,
    values: [raster, celestial, scene, runtime, content,
      // Observed surfaces and radial layers publish their own files; the manifest reads them by url, as it reads every other asset.
      ...[observed, radial].filter(entry => entry !== null).map(entry => {
        const source = entry as { assets: { filename: string; data?: Uint8Array }[] };
        return { schema: 'cssearth-prepared-published-assets@1',
          assets: source.assets.map(({ data: _data, filename, ...rest }) => ({ ...rest, filename, url: `/scenes/${descriptor.id}/${filename}` })) };
      })] });
  if (write) {
    const descriptorData = readObjectDescriptorRecord(JSON.parse(await readFile(descriptorPath, 'utf8')));
    const properties = record(descriptorData.properties, 'descriptor.properties');
    await writeFile(descriptorPath, `${JSON.stringify({ ...descriptorData, properties: { ...properties, worldFrame: scene.worldFrame } }, null, 2)}\n`);
    await writePreparedObject(descriptor.id, runtime as unknown as Record<string, unknown>);
  }
  const result = Object.freeze({ descriptor, sources, raster, celestial, scene, definition: runtime });
  await writeFile(resolve(outputDirectory, 'authored-preparation.json'), `${JSON.stringify({ schema: AUTHORED_PREPARATION_SCHEMA, id: descriptor.id, sources: entries.map(entry => ({ id: entry.reference.id, path: entry.reference.path })), lanes: { raster: true, celestial: true, geometry: true, content: true, presentation: true, ...(features ? { features: true } : {}) } } satisfies AuthoredPreparationReceipt)}\n`);
  return result;
}

/** The recipe keys a redraw run recomputes: the lighting and atmosphere banks, per lane recipe. */
const REDRAWN_KEYS: Readonly<Record<string, readonly string[]>> = { raster: ['lighting', 'atmosphere'], 'paged-ellipsoid': ['material', 'limb', 'atmosphere'] };

/** A recipe's bytes as the object's last published preparation read them: git's copy at the last commit of its
 * `inventory.json`, which a publication commits. Null when git holds no such version. */
export type PublishedRecipeReader = (file: string) => Promise<Buffer | null>;
export function recipesAtPublication(objectDirectory: string, root = process.cwd()): PublishedRecipeReader {
  const git = (...args: string[]) => execFileSync('git', args, { cwd: root, encoding: 'buffer', maxBuffer: 64 * 1024 * 1024 });
  const inventory = relative(root, resolve(objectDirectory, 'inventory.json'));
  let publication: string | undefined;
  return async file => {
    publication ??= git('log', '-n', '1', '--format=%H', '--', inventory).toString().trim();
    if (!publication) return null;
    try { return git('show', `${publication}:${relative(root, file)}`); } catch { return null; }
  };
}

/**
 * Whether a --write run can redraw only the lighting and atmosphere banks and carry every other published image: the lane
 * has that path, the object is published, and since its published preparation no recipe changed except in the keys those
 * banks read. The published record names each recipe by id and path; its published bytes come from git (`recipesAtPublication`).
 */
export async function redrawOnlyDecision(objectDirectory: string, publishedRecipe: PublishedRecipeReader = recipesAtPublication(objectDirectory)):
  Promise<{ redraw: true; acceptChanged: string[]; reason: string } | { redraw: false; reason: string }> {
  const { entries, sources } = await readAuthoredSources(objectDirectory);
  const geometrySchema = String((source(sources, 'geometry')?.value as Record<string, unknown> | undefined)?.schema);
  const rasterLane = (source(sources, 'raster')?.value as Record<string, unknown> | undefined)?.schema === RASTER_RECIPE_SCHEMA &&
    !['terrestrial', 'shape-model', 'observations', 'rings'].some(sourceId => source(sources, sourceId)) &&
    ![LAYERED_OBLATE_SCHEMA, BANDED_ELLIPSOID_SCHEMA].includes(geometrySchema);
  if (!source(sources, 'paged-ellipsoid') && !rasterLane) return { redraw: false, reason: 'its lane has no redraw-only path' };
  const recordPath = resolve(objectDirectory, 'prepared/authored-preparation.json');
  const published: unknown = await readFile(recordPath, 'utf8').then(text => JSON.parse(text) as unknown, () => null);
  const listed = readAuthoredPreparationSources(published, recordPath);
  if (!listed || !await access(resolve(objectDirectory, 'inventory.json')).then(() => true, () => false)) return { redraw: false, reason: 'nothing is published to carry' };
  const before = new Map(listed.map(value => [value.id, value] as const)), acceptChanged: string[] = [];
  const without = (value: unknown, keys: readonly string[]) => JSON.stringify(Object.fromEntries(Object.entries(record(value, 'recipe')).filter(([key]) => !keys.includes(key))));
  for (const id of new Set([...before.keys(), ...entries.map(entry => entry.reference.id)])) {
    const was = before.get(id), now = entries.find(entry => entry.reference.id === id);
    if (!was || !now || was.path !== now.reference.path) return { redraw: false, reason: `recipe source ${id} changed` };
    const path = relative(process.cwd(), now.path), bytes = await publishedRecipe(now.path);
    if (!bytes) return { redraw: false, reason: `git holds no published version of ${path}` };
    if (bytes.equals(await readFile(now.path))) continue;
    const keys = REDRAWN_KEYS[id];
    if (!keys) return { redraw: false, reason: `recipe source ${id} changed` };
    const comparable = readComparableSource(JSON.parse(bytes.toString('utf8')), now.value);
    if (comparable === null || without(comparable, keys) !== without(now.value, keys)) return { redraw: false, reason: `${path} changed outside ${keys.join(', ')}` };
    acceptChanged.push(id);
  }
  // A redraw carries the published feature anchors, which were placed with the left edge the published feature record states.
  const surfaceMap = (source(sources, 'features')?.value as { surfaceMap?: unknown } | undefined)?.surfaceMap;
  if (typeof surfaceMap === 'string') {
    const edge = (JSON.parse(await readFile(resolve(objectDirectory, 'source', surfaceMap), 'utf8')) as { mapLeftEdgeLongitudeDeg?: unknown }).mapLeftEdgeLongitudeDeg;
    const publishedEdge = await readFile(resolve(objectDirectory, 'prepared/features.json'), 'utf8')
      .then(text => readFeatureMapLongitude(JSON.parse(text)), () => undefined);
    if (publishedEdge !== edge) return { redraw: false, reason: `the surface map's left edge is ${String(edge)}° E, but the published feature anchors used ${String(publishedEdge)}° E` };
  }
  return { redraw: true, acceptChanged, reason: acceptChanged.length ? `only ${acceptChanged.map(id => `${id} ${REDRAWN_KEYS[id]!.join('/')}`).join(', ')} changed` : 'no recipe changed' };
}

const [id, ...flags] = process.argv.slice(2);
const direct = process.argv[1] !== undefined && import.meta.url === pathToFileURL(resolve(process.argv[1])).href;
if (direct) {
  const accepting = flags.find(flag => flag.startsWith('--accept-changed='));
  if (!id || !/^[a-z][a-z0-9-]*$/u.test(id) || flags.some(flag => flag !== '--write' && flag !== '--reuse-images' && flag !== '--full' && flag !== accepting) || new Set(flags).size !== flags.length ||
      ((flags.includes('--reuse-images') || flags.includes('--full')) && !flags.includes('--write')) || (flags.includes('--reuse-images') && flags.includes('--full')) || (accepting && !flags.includes('--reuse-images')))
    throw new TypeError('Usage: prepare-authored <object-id> [--write [--full | --reuse-images [--accept-changed=<source-id,...>]]].');
  let acceptChanged = accepting ? accepting.slice('--accept-changed='.length).split(',').filter(Boolean) : [];
  if (acceptChanged.some(source => !/^[a-z][a-z0-9-]*$/u.test(source))) throw new TypeError('--accept-changed takes recipe source ids.');
  const root = process.cwd(), write = flags.includes('--write');
  let reuseImages = flags.includes('--reuse-images');
  // A write redraws only the lighting and atmosphere banks when nothing else changed; --full bakes everything.
  if (write && !reuseImages && !flags.includes('--full')) {
    const decision = await redrawOnlyDecision(resolve(root, 'src/objects', id));
    if (decision.redraw) { reuseImages = true; acceptChanged = decision.acceptChanged; }
    console.log(decision.redraw ? `${id}: redrawing only the lighting and atmosphere banks (${decision.reason}); --full bakes everything.` : `${id}: full preparation (${decision.reason}).`);
  }
  const result = await prepareAuthoredObject({ objectDirectory: resolve(root, 'src/objects', id), publicDirectory: write ? resolve(root, 'site/public/scenes', id) : resolve(root, '.local/full-json-migration/staged-public', id), outputDirectory: write ? resolve(root, 'src/objects', id, 'prepared') : resolve(root, '.local/full-json-migration/staged', id), write, reuseImages, acceptChanged });
  if (!write) {
    // A check run refuses labels its own report contradicts; write mode rewrites them.
    const legend = await stagedLegendLabelChanges(resolve(root, 'src/objects', id), resolve(root, '.local/full-json-migration/staged', id));
    if (legend.changes.length) throw new Error(`${id}: legend labels differ from the prepared stretch: ${legend.summary}; run prepare-authored ${id} --write.`);
  }
  console.log(JSON.stringify({ id: result.descriptor.id, runtime: result.definition !== undefined }));
}

/** Stars and unlit bodies publish a null directional Sun. */
export function readPublishedSun(value: unknown) {
  return value === null ? null : validateDirectionalSunPlan(value);
}
