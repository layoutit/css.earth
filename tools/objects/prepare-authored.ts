import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { relative, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { parseAuthoredObjectDescriptor, type AuthoredObjectDescriptor, type SourceReference } from '@cssearth/objects';
import { parseRasterRecipe, prepareRasterAssets } from '../../src/preparation/raster/index.js';
import { parseGeometryProfile, prepareGeometryScene, type GeometrySceneAssets, type SolarSceneSource } from '../../src/renderers/css/preparation/scene/index.js';
import { parsePresentationProfile, prepareCssPresentation, type PresentationInputs } from '../../src/renderers/css/preparation/presentation/index.js';
import { prepareCelestialAssets } from './celestial/index.js';
import { prepareObjectContentAssets } from './content/prepare.js';
import { loadGeometryAdapters } from './geometry-adapters.js';
import { prepareRuntimeManifest } from './operations.js';

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
  const module = record(await import(pathToFileURL(resolve(process.cwd(), 'tools/prepare-object-json.mjs')).href), 'prepared object writer');
  const write = module.writeObjectJson;
  if (typeof write !== 'function') throw new TypeError('Prepared object writer is missing.');
  await (write as (objectId: string, runtime: Record<string, unknown>) => Promise<unknown>)(id, definition);
}

/** Verify authored source pins, then prepare each available generic capability lane. */
export async function prepareAuthoredObject({ objectDirectory, publicDirectory, outputDirectory, write = false }: AuthoredPreparationContext): Promise<AuthoredPreparationResult> {
  const descriptorPath = resolve(objectDirectory, 'object.json');
  const descriptor = parseAuthoredObjectDescriptor(JSON.parse(await readFile(descriptorPath, 'utf8')) as unknown);
  const entries = await Promise.all(descriptor.recipe.sources.map(reference => verifiedSource(objectDirectory, reference)));
  const sources = new Map(entries.map(entry => [entry.reference.id, entry]));
  await mkdir(outputDirectory, { recursive: true });
  const sourceDirectory = resolve(objectDirectory, 'source');
  const raster = await prepareRasterAssets({ sourceDirectory, publicDirectory, outputDirectory, config: parseRasterRecipe(required(sources, 'raster').value) });
  const celestial = await prepareCelestialAssets({ sourceDirectory, publicDirectory, outputDirectory, config: required(sources, 'celestial').value });
  const rasterConfig = parseRasterRecipe(required(sources, 'raster').value), geometryConfig = parseGeometryProfile(required(sources, 'geometry').value);
  const solarSource = physicalSolarSource(required(sources, 'solar-system').value);
  const scene = await prepareGeometryScene({ profile: geometryConfig, raster: rasterConfig, assets: raster as unknown as GeometrySceneAssets, solarSource, starfield: celestial.sky as unknown as Record<string, unknown> & { faces: readonly unknown[] }, sun: celestial.sun as unknown as Record<string, unknown>, adapters: await loadGeometryAdapters(), outputDirectory });
  const contentReference = required(sources, 'content');
  const content = await prepareObjectContentAssets({ sourceDirectory, publicDirectory, outputDirectory, config: { contentPath: relative(sourceDirectory, contentReference.path) } });
  validateCapabilityComposition(descriptor, rasterConfig as unknown as Record<string, unknown>, geometryConfig as unknown as Record<string, unknown>, solarSource, content.lenses);
  const presentation = parsePresentationProfile(required(sources, 'presentation').value);
  const definition = await prepareCssPresentation({ namespace: presentation.namespace, mode: presentation.mode, scene: scene as unknown as PresentationInputs['scene'], assets: raster as unknown as PresentationInputs['assets'], lenses: content.lenses as unknown as PresentationInputs['lenses'], sun: celestial.sun as unknown as PresentationInputs['sun'], markers: celestial.markers, solarSource: solarSource as unknown as PresentationInputs['solarSource'], controls: content.controls as unknown as PresentationInputs['controls'] });
  await writeFile(resolve(outputDirectory, 'runtime.json'), `${JSON.stringify(definition)}\n`);
  await prepareRuntimeManifest({ id: descriptor.id, publicRoot: publicDirectory,
    manifestPath: write ? resolve(objectDirectory, 'runtime-assets.json') : resolve(outputDirectory, 'runtime-assets.json'),
    values: [raster, celestial, scene, definition, content] });
  if (write) {
    const descriptorData = record(JSON.parse(await readFile(descriptorPath, 'utf8')) as unknown, 'descriptor');
    const properties = record(descriptorData.properties, 'descriptor.properties');
    await writeFile(descriptorPath, `${JSON.stringify({ ...descriptorData, properties: { ...properties, worldFrame: scene.worldFrame } }, null, 2)}\n`);
    await writePreparedObject(descriptor.id, definition as unknown as Record<string, unknown>);
  }
  const result = Object.freeze({ descriptor, sources, raster, celestial, scene, definition });
  await writeFile(resolve(outputDirectory, 'authored-preparation.json'), `${JSON.stringify({ schema: 'cssearth-authored-preparation@1', id: descriptor.id, sources: entries.map(entry => entry.reference), lanes: { raster: true, celestial: true, geometry: true, content: true, presentation: true } })}\n`);
  return result;
}

const [id, flag] = process.argv.slice(2);
const direct = process.argv[1] !== undefined && import.meta.url === pathToFileURL(resolve(process.argv[1])).href;
if (direct) {
  if (!id || !/^[a-z][a-z0-9-]*$/u.test(id) || (flag !== undefined && flag !== '--write')) throw new TypeError('Usage: prepare-authored <object-id> [--write].');
  const root = process.cwd(), write = flag === '--write';
  const result = await prepareAuthoredObject({ objectDirectory: resolve(root, 'src/planets', id), publicDirectory: write ? resolve(root, 'public/scenes', id) : resolve(root, '.local/full-json-migration/staged-public', id), outputDirectory: write ? resolve(root, 'objects/preparation', id) : resolve(root, '.local/full-json-migration/staged', id), write });
  console.log(JSON.stringify({ id: result.descriptor.id, runtime: result.definition !== undefined }));
}
