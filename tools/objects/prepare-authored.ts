import { createHash } from 'node:crypto';
import { mkdir, mkdtemp, copyFile, cp, readFile, writeFile } from 'node:fs/promises';
import { relative, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { parseAuthoredObjectDescriptor, type AuthoredObjectDescriptor, type SourceReference } from '@cssearth/objects';
import { parseRasterRecipe, prepareRasterAssets } from '../../src/preparation/raster/index.js';
import type { ObservationInterpretation } from '../../src/preparation/raster/index.js';
import { parseGeometryProfile, prepareGeometryScene, type GeometrySceneAssets, type SolarSceneSource } from '../../src/renderers/css/preparation/scene/index.js';
import { parsePresentationProfile, prepareCssPresentation, type PresentationInputs } from '../../src/renderers/css/preparation/presentation/index.js';
import { prepareCelestialAssets } from './celestial/index.js';
import { prepareObjectContentAssets } from './content/prepare.js';
import { loadGeometryAdapters } from './geometry-adapters.js';
import { prepareRuntimeManifest } from './operations.js';
import { prepareWorldNavigationDefinition, writeWorldNavigationArtifacts } from './prepare-world-navigation.js';
import { attachSurfaceFeatures, writeFeatureContent } from './surface-features/attach.js';

export interface AuthoredPreparationContext { readonly objectDirectory: string; readonly publicDirectory: string; readonly outputDirectory: string; readonly write?: boolean; }
export interface VerifiedSource { readonly reference: SourceReference; readonly path: string; readonly value: unknown; }
export interface AuthoredPreparationResult { readonly descriptor: AuthoredObjectDescriptor; readonly sources: ReadonlyMap<string, VerifiedSource>; readonly raster?: unknown; readonly celestial?: unknown; readonly scene?: unknown; readonly definition?: unknown; }
type Input = Record<string, unknown>;

function record(value: unknown, at: string): Input { if (!value || typeof value !== 'object' || Array.isArray(value)) throw new TypeError(`${at} must be an object.`); return value as Input; }
function contained(root: string, path: string): string { const resolved = resolve(root, path), offset = relative(root, resolved); if (offset === '..' || offset.startsWith(`..${String.fromCharCode(47)}`) || offset.startsWith(`..${String.fromCharCode(92)}`)) throw new TypeError(`Source ${path} escapes its object directory.`); return resolved; }
async function verifiedSource(root: string, reference: SourceReference): Promise<VerifiedSource> {
  const path = contained(root, reference.path), bytes = await readFile(path);
  if (createHash('sha256').update(bytes).digest('hex') !== reference.sha256) throw new TypeError(`Source ${reference.path} does not match its descriptor digest.`);
  try { return Object.freeze({ reference, path, value: JSON.parse(bytes.toString('utf8')) as unknown }); }
  catch { throw new TypeError(`Source ${reference.path} must be JSON configuration.`); }
}
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
  if (materialSources.has('raster') && rasterConfig.lighting === undefined && rasterConfig.atmosphere === undefined) throw new TypeError('Authored material has no prepared raster backend.');
  if (Boolean(descriptor.recipe.cutaway) !== Boolean(rasterConfig.interior) || Boolean(descriptor.recipe.cutaway) !== Boolean(geometryConfig.cutaway)) throw new TypeError('Authored cutaway and its prepared geometry/assets disagree.');
  if (Boolean(descriptor.recipe.atmosphere) !== Boolean(rasterConfig.atmosphere)) throw new TypeError('Authored atmosphere and its prepared raster backend disagree.');
  const declared = new Set(descriptor.recipe.surfaces.flatMap(surface => surface.lenses.map(lens => lens.id)));
  const prepared = ids(record(lenses, 'prepared lenses').controls, 'prepared lenses.controls');
  sameIds(prepared, declared, 'Prepared lenses');
}
async function writePreparedObject(id: string, definition: Record<string, unknown>): Promise<void> {
  const module = record(await import(pathToFileURL(resolve(process.cwd(), 'tools/prepare-object-json.mts')).href), 'prepared object writer');
  const write = module.writeObjectJson;
  if (typeof write !== 'function') throw new TypeError('Prepared object writer is missing.');
  await (write as (objectId: string, runtime: Record<string, unknown>) => Promise<unknown>)(id, definition);
}

/** Verify authored source pins, then prepare each available generic capability lane. */
export async function prepareAuthoredObject({ objectDirectory, publicDirectory, outputDirectory, write = false }: AuthoredPreparationContext): Promise<AuthoredPreparationResult> {
  const result = await prepareAuthoredStages({ objectDirectory, publicDirectory, outputDirectory, write });
  if (write || !result.definition) return result;
  const { prepareSurfaceMinimaps } = await import(pathToFileURL(resolve(process.cwd(), 'tools/prepare-surface-minimaps.mts')).href);
  await prepareSurfaceMinimaps({ objectDirectory, publicDirectory, outputDirectory });
  const prepared = await prepareWorldNavigationDefinition({ objectDirectory, definition: result.definition as Record<string, unknown> });
  const scene = await writeWorldNavigationArtifacts(outputDirectory, prepared, result.scene as Record<string, unknown> | undefined);
  const { prepareObjectProvenance } = await import(pathToFileURL(resolve(process.cwd(), 'tools/objects/provenance.mts')).href);
  await prepareObjectProvenance({ objectDirectory, publicDirectory, outputDirectory, basis: 'prepared' });
  return Object.freeze({ ...result, definition: prepared.definition, scene });
}

async function prepareAuthoredStages({ objectDirectory, publicDirectory, outputDirectory, write = false }: AuthoredPreparationContext): Promise<AuthoredPreparationResult> {
  if (write) {
    const id = record(JSON.parse(await readFile(resolve(objectDirectory, 'object.json'), 'utf8')), 'descriptor').id;
    if (typeof id !== 'string' || !/^[a-z][a-z0-9-]*$/u.test(id)) throw new TypeError('Invalid preparation identity.');
    const stageRoot = resolve(process.cwd(), '.local/object-preparation');
    await mkdir(stageRoot, { recursive: true });
    const stage = await mkdtemp(resolve(stageRoot, `${id}-`));
    const stagedPublic = resolve(stage, 'public'), stagedData = resolve(stage, 'prepared');
    const result = await prepareAuthoredObject({ objectDirectory, publicDirectory: stagedPublic, outputDirectory: stagedData });
    const { publishPreparedAssets, readPreparedJsonOutputs } = await import(pathToFileURL(resolve(process.cwd(), 'tools/objects/publication.mts')).href) as typeof import('./publication.mts');
    if (!result.definition) throw new TypeError('Preparation produced no runtime payload.');
    const outputs = await readPreparedJsonOutputs(stagedData);
    const manifest = JSON.parse(await readFile(resolve(stagedData, 'runtime-assets.json'), 'utf8'));
    const previous = await readFile(resolve(objectDirectory, 'runtime-assets.json'), 'utf8').then(JSON.parse,
      (error: NodeJS.ErrnoException) => { if (error.code === 'ENOENT') return null; throw error; });
    await publishPreparedAssets({ id, stage: stagedPublic, destination: publicDirectory, previous, manifest, recovery: resolve(stage, 'previous-public') });
    await mkdir(outputDirectory, { recursive: true });
    for (const entry of outputs) {
      await copyFile(entry.path, resolve(outputDirectory, entry.filename));
    }
    await cp(resolve(stagedData, 'minimaps'), resolve(outputDirectory, 'minimaps'), { recursive: true })
      .catch((error: NodeJS.ErrnoException) => { if (error.code !== 'ENOENT') throw error; });
    await copyFile(resolve(stagedData, 'runtime-assets.json'), resolve(objectDirectory, 'runtime-assets.json'));
    const scene = result.scene as Record<string, unknown> | undefined;
    if (scene?.worldFrame !== undefined) {
      const path = resolve(objectDirectory, 'object.json'), raw = JSON.parse(await readFile(path, 'utf8'));
      await writeFile(path, `${JSON.stringify({ ...raw, properties: { ...raw.properties, worldFrame: scene.worldFrame } }, null, 2)}\n`);
    }
    await writePreparedObject(id, result.definition as Record<string, unknown>);
    return result;
  }
  const descriptorPath = resolve(objectDirectory, 'object.json');
  const descriptor = parseAuthoredObjectDescriptor(JSON.parse(await readFile(descriptorPath, 'utf8')) as unknown);
  const entries = await Promise.all(descriptor.recipe.sources.map(reference => verifiedSource(objectDirectory, reference)));
  const sources = new Map(entries.map(entry => [entry.reference.id, entry]));
  // Nomenclature labels ride the generic sphere lane; other lanes declare no mesh anchor frame yet.
  const genericLaneOnly = () => { if (descriptor.recipe.features) throw new TypeError('Surface features are prepared by the generic authored lane only.'); };
  if ((source(sources, 'geometry')?.value as Record<string, unknown> | undefined)?.schema === 'cssearth-static-surface-geometry@1') {
    const { prepareStaticSurfaceObject } = await import(pathToFileURL(resolve(process.cwd(), 'tools/objects/static-surface/index.mts')).href) as typeof import('./static-surface/index.mts');
    return prepareStaticSurfaceObject({ objectDirectory, publicDirectory, outputDirectory, write });
  }
  await mkdir(outputDirectory, { recursive: true });
  const sourceDirectory = resolve(objectDirectory, 'source');
  if ((source(sources, 'geometry')?.value as Record<string, unknown> | undefined)?.schema === 'cssearth-layered-oblate-preparation@1') {
    genericLaneOnly();
    const { prepareLayeredOblateObject } = await import(pathToFileURL(resolve(process.cwd(), 'tools/objects/material-composition/index.mts')).href) as typeof import('./material-composition/index.mts');
    return prepareLayeredOblateObject({ objectDirectory, publicDirectory, outputDirectory, write, prepareContent: prepareObjectContentAssets });
  }
  if (source(sources, 'paged-ellipsoid')) {
    genericLaneOnly();
    const { preparePagedEllipsoidObject } = await import(pathToFileURL(resolve(process.cwd(), 'tools/objects/paged-ellipsoid/index.mts')).href) as typeof import('./paged-ellipsoid/index.mts');
    const prepared = await preparePagedEllipsoidObject({ objectDirectory, publicDirectory, outputDirectory, prepareContent: prepareObjectContentAssets });
    await prepareRuntimeManifest({ id: descriptor.id, publicRoot: publicDirectory,
      manifestPath: write ? resolve(objectDirectory, 'runtime-assets.json') : resolve(outputDirectory, 'runtime-assets.json'),
      allowPreparationArtifacts: true,
      values: [prepared.definition, prepared.content] });
    if (write) await writePreparedObject(descriptor.id, prepared.definition);
    return Object.freeze({ ...prepared });
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
      config: terrestrial, prepareContent: prepareObjectContentAssets });
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
  // Scientific surfaces are interpreted by the shared observation decoders (numeric grids, palettes, tonal
  // presentation, missing-coverage grid) before the raster lane packs them; src never imports tools.
  const { observationRaster } = await import(pathToFileURL(resolve(process.cwd(), 'tools/objects/static-surface/raster.mts')).href) as typeof import('./static-surface/raster.mts');
  const { parseObservationPreviewLens } = await import(pathToFileURL(resolve(process.cwd(), 'tools/objects/static-surface/source-contract.mts')).href) as typeof import('./static-surface/source-contract.mts');
  const interpret: ObservationInterpretation = async (surface, width, height) => {
    const plan = parseObservationPreviewLens({ id: surface.id, input: surface.source, ...surface.science });
    const { data, info } = await observationRaster({ input: resolve(sourceDirectory, surface.source), plan, width, height });
    if (![1, 2, 3, 4].includes(info.channels)) throw new TypeError(`Interpreted surface ${surface.id} has ${info.channels} channels.`);
    const scientific = surface.science.scientific as { displaySampling?: unknown; categories?: unknown } | undefined;
    return { data, channels: info.channels as 1 | 2 | 3 | 4, nearest: scientific?.displaySampling === 'nearest' || Array.isArray(scientific?.categories) };
  };
  const raster = await prepareRasterAssets({ sourceDirectory, publicDirectory, outputDirectory, config: parseRasterRecipe(required(sources, 'raster').value), interpret });
  const celestial = await prepareCelestialAssets({ sourceDirectory, publicDirectory, outputDirectory, config: required(sources, 'celestial').value });
  const rasterConfig = parseRasterRecipe(required(sources, 'raster').value), geometryConfig = parseGeometryProfile(required(sources, 'geometry').value);
  const solarSource = physicalSolarSource(required(sources, 'solar-system').value);
  const scene = await prepareGeometryScene({ profile: geometryConfig, raster: rasterConfig, assets: raster as unknown as GeometrySceneAssets, solarSource, starfield: celestial.sky as unknown as Record<string, unknown> & { faces: readonly unknown[] }, sun: celestial.sun as unknown as Record<string, unknown>, adapters: await loadGeometryAdapters(), outputDirectory });
  const contentReference = required(sources, 'content');
  const content = await prepareObjectContentAssets({ sourceDirectory, publicDirectory, outputDirectory, config: { contentPath: relative(sourceDirectory, contentReference.path) } });
  validateCapabilityComposition(descriptor, rasterConfig as unknown as Record<string, unknown>, geometryConfig as unknown as Record<string, unknown>, solarSource, content.lenses);
  const presentation = parsePresentationProfile(required(sources, 'presentation').value);
  const definition = await prepareCssPresentation({ namespace: presentation.namespace, mode: presentation.mode, scene: scene as unknown as PresentationInputs['scene'], assets: raster as unknown as PresentationInputs['assets'], lenses: content.lenses as unknown as PresentationInputs['lenses'], sun: celestial.sun as unknown as PresentationInputs['sun'], markers: celestial.markers, solarSource: solarSource as unknown as PresentationInputs['solarSource'], controls: content.controls as unknown as PresentationInputs['controls'], ...(presentation.textureLevels ? { textureLevels: presentation.textureLevels } : {}) });
  const attached = await attachSurfaceFeatures({ descriptor, sources, sourceDirectory, publicDirectory, outputDirectory, definition: definition as unknown as Record<string, unknown> });
  const runtime = attached.definition, features = attached.features !== null;
  if (attached.features) await writeFeatureContent(outputDirectory, attached.features);
  await writeFile(resolve(outputDirectory, 'runtime.json'), `${JSON.stringify(runtime)}\n`);
  await prepareRuntimeManifest({ id: descriptor.id, publicRoot: publicDirectory,
    manifestPath: write ? resolve(objectDirectory, 'runtime-assets.json') : resolve(outputDirectory, 'runtime-assets.json'),
    values: [raster, celestial, scene, runtime, content] });
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

const [id, flag] = process.argv.slice(2);
const direct = process.argv[1] !== undefined && import.meta.url === pathToFileURL(resolve(process.argv[1])).href;
if (direct) {
  if (!id || !/^[a-z][a-z0-9-]*$/u.test(id) || (flag !== undefined && flag !== '--write')) throw new TypeError('Usage: prepare-authored <object-id> [--write].');
  const root = process.cwd(), write = flag === '--write';
  const result = await prepareAuthoredObject({ objectDirectory: resolve(root, 'src/planets', id), publicDirectory: write ? resolve(root, 'public/scenes', id) : resolve(root, '.local/full-json-migration/staged-public', id), outputDirectory: write ? resolve(root, 'src/planets', id, 'prepared') : resolve(root, '.local/full-json-migration/staged', id), write });
  console.log(JSON.stringify({ id: result.descriptor.id, runtime: result.definition !== undefined }));
}
