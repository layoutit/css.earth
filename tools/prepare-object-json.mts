import { sha256 } from '../src/platform/sha256.mts';
import { preparePageMetadata } from './prepared-page-metadata.mts';
import {parseObjectDescriptor} from '@cssearth/objects';
import {requireObjectRuntimeDefinition} from './object-runtime-contract.mts';
import {requireRecord,requireString,isRecord,hasErrorCode} from './source-values.mts';
import type {CheckedObjectRuntimeDefinition} from './object-runtime-contract.mts';
import type {RecompiledPresentation} from './prepared-depth-partitions.mts';
/** `keepBindings` re-derives the world frame and default camera over an already bound runtime and keeps its presentation
 * bindings (facing planes, depth partitions, interior fill). Facing planes are browser-measured against the solved
 * system node, so this is only safe when that solve did not move: refuse rather than publish stale geometry. */
type BindingOptions=Parameters<typeof preparePresentationBindings>[2] & {keepBindings?: boolean};

/** `--keep-bindings` keeps browser-measured facing planes and depth partitions from before this navigation pass.
 * Those are only trustworthy if the solved system transform they were measured against did not move: prepared
 * navigation's own `{from, to}` pair (prepare-world-navigation.ts's `replaceSystemTransform`) already names the
 * bound (`from`) and freshly solved (`to`) copies. Refuse loudly instead of publishing stale geometry. */
export function refuseStaleKeptBindings(id: string, systemTransform: { readonly from: string; readonly to: string } | null): void {
  if (systemTransform && systemTransform.from !== systemTransform.to) {
    throw new TypeError(`${id}: --keep-bindings refused; the solved system transform moved (was ${systemTransform.from}, now ${
      systemTransform.to}), so the bound facing planes and depth partitions no longer match it. Re-run without --keep-bindings.`);
  }
}
import { access, mkdir, readFile } from 'node:fs/promises';
import { resolve, sep } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { SCENE_OBJECTS } from '../site/objects.mts';
import { authoredObject } from './authored-object.mts';
import { preparePresentationBindings } from './prepared-presentation-bindings.mts';
import { writePreparedText } from './write-prepared-text.mts';
import { PREPARED_CSS_OBJECT_FORMAT } from '../src/renderers/css/dist/index.js';
import { preparePreparedAssetManifest } from '../src/platform/runtime-asset-closure.mts';

const root = fileURLToPath(new URL('../', import.meta.url));
const format = PREPARED_CSS_OBJECT_FORMAT;

export function serializeObjectJson(descriptorValue:unknown, definitionValue:unknown) {
  const descriptor=requireRecord(descriptorValue),definition=requireRecord(definitionValue);
  if (descriptor.schema !== 'cssearth-object@1' || typeof descriptor.type !== 'string' ||
      definition.id !== descriptor.id || definition.schema !== 'cssearth-object-runtime@4') {
    throw new TypeError('Prepared object identity does not match its descriptor.');
  }
  return JSON.stringify({ schema: 'cssearth-prepared-object@1', id: descriptor.id,
    type: descriptor.type, format, data: definition });
}

export async function writeObjectJson(id:string, definitionValue:unknown, options?:BindingOptions) {
  const { definition: _definition, ...pin } = await finalizeObjectJson(id, definitionValue, { projectRoot: root, objectDirectory: resolve(root, 'src/objects', id),
    preparedDirectory: resolve(root, 'src/objects', id, 'prepared'), descriptorPath: resolve(root, 'src/objects', id, 'object.json') }, options);
  return pin;
}

/** Finalize into explicit destinations. Source/style reads still use the real project. */
export async function finalizeObjectJson(id: string, definitionValue: unknown, target: {
  projectRoot: string; objectDirectory: string; preparedDirectory: string; descriptorPath: string;
}, options?: BindingOptions) {
  let definition:RecompiledPresentation<CheckedObjectRuntimeDefinition>=requireObjectRuntimeDefinition(definitionValue);
  if (!SCENE_OBJECTS.some(object => object.id === id) || definition.id !== id || definition.schema !== 'cssearth-object-runtime@4') {
    throw new TypeError('Prepared object identity does not match the application registry.');
  }
  const { projectRoot, objectDirectory, preparedDirectory } = target;
  const originalDescriptor = requireRecord(JSON.parse(await readFile(resolve(objectDirectory, 'object.json'), 'utf8')));
  let descriptor = parseObjectDescriptor(originalDescriptor);
  if (descriptor.schema !== 'cssearth-object@1' || descriptor.id !== id || typeof descriptor.type !== 'string') {
    throw new TypeError('Prepared object descriptor identity is invalid.');
  }
  const { prepareWorldNavigationDefinition, writeWorldNavigationArtifacts } = await import('./objects/dist/prepare-world-navigation.js');
  const preparedNavigation = await prepareWorldNavigationDefinition({ objectDirectory, definition, projectRoot });
  definition = requireObjectRuntimeDefinition(preparedNavigation.definition);
  if (options?.keepBindings) refuseStaleKeptBindings(id, preparedNavigation.systemTransform);
  else definition = await preparePresentationBindings(definition, projectRoot, options);
  const scene:unknown = JSON.parse(await readFile(resolve(preparedDirectory, 'scene.json'), 'utf8'));
  await writeWorldNavigationArtifacts(preparedDirectory, { ...preparedNavigation, definition }, requireRecord(scene));
  descriptor = parseObjectDescriptor({ ...descriptor, properties: { ...descriptor.properties, worldFrame: preparedNavigation.frame } });
  const pin = await pinPreparedObject(id, originalDescriptor, { worldFrame: preparedNavigation.frame }, projectRoot, target);
  return { id, ...pin, definition };
}

/** Transport the prepared runtime and pin descriptor and page to it. */
async function pinPreparedObject(id: string, originalDescriptor: Record<string, unknown>, properties: Record<string, unknown>, root: string,
  target = { preparedDirectory: resolve(root, 'src/objects', id, 'prepared'), descriptorPath: resolve(root, 'src/objects', id, 'object.json') }) {
  const { preparedDirectory, descriptorPath } = target;
  await mkdir(preparedDirectory, { recursive: true });
  const definition = requireObjectRuntimeDefinition(JSON.parse(await readFile(resolve(preparedDirectory, 'runtime.json'), 'utf8')));
  const runtime: unknown = JSON.parse(await readFile(resolve(preparedDirectory, 'runtime.json'), 'utf8'));
  const originalProperties = requireRecord(originalDescriptor.properties);
  const descriptor = parseObjectDescriptor({ ...originalDescriptor, properties: { ...originalProperties, ...properties } });
  const payload = serializeObjectJson(descriptor, runtime);
  await writePreparedText(resolve(preparedDirectory, 'object.json'), payload);
  const prepared = { format, url: 'prepared/object.json', sha256: sha256(payload) };
  const page = preparePageMetadata(id, prepared.sha256, definition);
  await writePreparedText(resolve(preparedDirectory, 'page.json'), page.text);
  // Validation may normalize key order. Retain the authored document's order
  // so an unchanged prepared object does not rewrite its descriptor.
  await writePreparedText(descriptorPath, `${JSON.stringify({ ...originalDescriptor,
    properties: { ...originalProperties, ...properties,
      page: { ...requireRecord(originalProperties.page), metadata: page.reference } }, prepared }, null, 2)}\n`);
  // Only runtime.json/scene.json move to R2. provenance.json and page.json are generated on every checkout; every
  // other prepared/* file (content.json, controls.json, …) stays a tracked contract file. None are part of this inventory.
  const inventoried: string[] = [];
  for (const filename of ['runtime.json', 'scene.json']) {
    if (await access(resolve(preparedDirectory, filename)).then(() => true, () => false)) inventoried.push(filename);
  }
  if (inventoried.length) {
    await preparePreparedAssetManifest({ planetId: id, preparedRoot: preparedDirectory,
      manifestPath: resolve(preparedDirectory, '..', 'prepared-assets.json'), filenames: inventoried });
  }
  return { bytes: Buffer.byteLength(payload), ...prepared };
}

/** Re-pin an already prepared object to its transport without preparing anything. */
export async function repinObjectJson(id: string, projectRoot = root) {
  const descriptorPath = resolve(projectRoot, 'src/objects', id, 'object.json');
  const originalDescriptor = requireRecord(JSON.parse(await readFile(descriptorPath, 'utf8')));
  const before = JSON.stringify(originalDescriptor.prepared);
  const pin = await pinPreparedObject(id, originalDescriptor, {}, projectRoot);
  return before !== JSON.stringify({ format: pin.format, url: pin.url, sha256: pin.sha256 });
}

/** Existing descriptors opt into JSON baking; planned objects get no fallback. */
export async function updateObjectJsonForPresentation(target:string|URL, presentation:unknown, controls:unknown) {
  const file = target instanceof URL ? fileURLToPath(target) : resolve(target);
  const match = file.split(sep).join('/').match(/\/src\/objects\/([a-z][a-z0-9-]*)\/runtime\/preparedPresentation\.mjs$/);
  if (!match) return null;
  const id = match[1];
  try { await access(resolve(root, 'src/objects', id, 'object.json')); }
  catch (error) { if (hasErrorCode(error,'ENOENT')) return null; throw error; }
  return writeObjectJson(id, { ...requireRecord(presentation), schema: 'cssearth-object-runtime@4', id, controls });
}

export async function prepareObjectJson(ids?:readonly string[]|null, options?:BindingOptions) {
  const results = [];
  for (const object of SCENE_OBJECTS) {
    if (ids && !ids.includes(object.id)) continue;
    try { await access(resolve(root, 'src/objects', object.id, 'object.json')); }
    catch (error) { if (hasErrorCode(error,'ENOENT') && !ids) continue; throw error; }
    const runtimeDefinition:unknown = await authoredObject(object.id, root)
      ? JSON.parse(await readFile(resolve(root, 'src/objects', object.id, 'prepared/runtime.json'), 'utf8'))
      : requireRecord(await import(pathToFileURL(resolve(root, `src/objects/${object.id}/runtime/definition.mjs`)).href)).runtimeDefinition;
    results.push(await writeObjectJson(object.id, runtimeDefinition, options));
  }
  if (ids && results.length !== new Set(ids).size) throw new TypeError('A requested object has no registered JSON descriptor.');
  // Contexts consume finalized body frames. Preparing them first can retain a
  // previous radius and make an otherwise valid destination fail at handoff.
  const { prepareSpatialContext } = await import('./objects/dist/prepare-spatial-context.js');
  for (const object of SCENE_OBJECTS) {
    const directory = resolve(root, 'src/objects', object.id);
    const descriptor = parseObjectDescriptor(await readFile(resolve(directory, 'object.json'), 'utf8'));
    const recipe=descriptor.properties.recipe;
    if(!isRecord(recipe)||!Array.isArray(recipe.sources))continue;
    const source=recipe.sources.map((value:unknown)=>requireRecord(value)).find(source=>source.id==='world-context');
    if (!source) continue;
    await prepareSpatialContext({ sourcePath: resolve(directory, requireString(source.path)),
      outputPath: resolve(directory, 'prepared/world-context.json'),
      solarGeometryPath: resolve(root, 'src/platform/solar-geometry.mts') });
  }
  return results;
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  // --keep-bindings: a default camera or world frame change, which needs no browser or image work.
  const args = process.argv.slice(2), ids = args.filter(arg => arg !== '--keep-bindings');
  for (const result of await prepareObjectJson(ids.length ? ids : null, { keepBindings: args.includes('--keep-bindings') })) console.log(JSON.stringify(result));
}
