import {parseObjectDescriptor} from '@cssearth/objects';
import {requireObjectRuntimeDefinition} from './object-runtime-contract.mts';
import {requireRecord,requireString,isRecord,hasErrorCode} from './source-values.mts';
import type {CheckedObjectRuntimeDefinition} from './object-runtime-contract.mts';
import type {RecompiledPresentation} from './prepared-depth-partitions.mts';
type BindingOptions=Parameters<typeof preparePresentationBindings>[2];
import { createHash } from 'node:crypto';
import { access, mkdir, readFile } from 'node:fs/promises';
import { resolve, sep } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { OBJECTS } from '../site/objects.mts';
import { authoredObject } from './authored-object.mts';
import { preparePresentationBindings } from './prepared-presentation-bindings.mts';
import { writePreparedText } from './write-prepared-text.mts';
import { prepareMarkerBindings } from './prepare-marker-bindings.mts';

const root = fileURLToPath(new URL('../', import.meta.url));
const format = 'cssearth-css-object@4';

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
  let definition:RecompiledPresentation<CheckedObjectRuntimeDefinition>=requireObjectRuntimeDefinition(definitionValue);
  if (!OBJECTS.some(object => object.id === id) || definition.id !== id || definition.schema !== 'cssearth-object-runtime@4') {
    throw new TypeError('Prepared object identity does not match the application registry.');
  }
  const descriptorPath = resolve(root, 'src/planets', id, 'object.json');
  const originalDescriptor = requireRecord(JSON.parse(await readFile(descriptorPath, 'utf8')));
  let descriptor = parseObjectDescriptor(originalDescriptor);
  if (descriptor.schema !== 'cssearth-object@1' || descriptor.id !== id || typeof descriptor.type !== 'string') {
    throw new TypeError('Prepared object descriptor identity is invalid.');
  }
  const { prepareWorldNavigationDefinition, writeWorldNavigationArtifacts } = await import('./objects/dist/prepare-world-navigation.js');
  const objectDirectory = resolve(root, 'src/planets', id);
  definition = prepareMarkerBindings(definition);
  const preparedNavigation = await prepareWorldNavigationDefinition({ objectDirectory, definition, projectRoot: root });
  definition = requireObjectRuntimeDefinition(preparedNavigation.definition);
  definition = await preparePresentationBindings(definition, root, options);
  const scene:unknown = JSON.parse(await readFile(resolve(objectDirectory, 'prepared/scene.json'), 'utf8'));
  await writeWorldNavigationArtifacts(resolve(objectDirectory, 'prepared'), { ...preparedNavigation, definition }, requireRecord(scene));
  descriptor = parseObjectDescriptor({ ...descriptor, properties: { ...descriptor.properties, worldFrame: preparedNavigation.frame } });
  const payload = serializeObjectJson(descriptor, definition);
  const asset = resolve(root, 'src/planets', id, 'prepared/object.json');
  await mkdir(resolve(root, 'src/planets', id, 'prepared'), { recursive: true });
  await writePreparedText(asset, payload);
  const prepared = { format, url: 'prepared/object.json', sha256: createHash('sha256').update(payload).digest('hex') };
  // Validation may normalize key order. Retain the authored document's order
  // so an unchanged prepared object does not rewrite its descriptor.
  await writePreparedText(descriptorPath, `${JSON.stringify({ ...originalDescriptor,
    properties: { ...requireRecord(originalDescriptor.properties), worldFrame: preparedNavigation.frame }, prepared }, null, 2)}\n`);
  return { id, bytes: Buffer.byteLength(payload), ...prepared };
}

/** Existing descriptors opt into JSON baking; planned objects get no fallback. */
export async function updateObjectJsonForPresentation(target:string|URL, presentation:unknown, controls:unknown) {
  const file = target instanceof URL ? fileURLToPath(target) : resolve(target);
  const match = file.split(sep).join('/').match(/\/src\/planets\/([a-z][a-z0-9-]*)\/runtime\/preparedPresentation\.mjs$/);
  if (!match) return null;
  const id = match[1];
  try { await access(resolve(root, 'src/planets', id, 'object.json')); }
  catch (error) { if (hasErrorCode(error,'ENOENT')) return null; throw error; }
  return writeObjectJson(id, { ...requireRecord(presentation), schema: 'cssearth-object-runtime@4', id, controls });
}

export async function prepareObjectJson(ids?:readonly string[]|null, options?:BindingOptions) {
  const results = [];
  for (const object of OBJECTS) {
    if (ids && !ids.includes(object.id)) continue;
    try { await access(resolve(root, 'src/planets', object.id, 'object.json')); }
    catch (error) { if (hasErrorCode(error,'ENOENT') && !ids) continue; throw error; }
    const runtimeDefinition:unknown = await authoredObject(object.id, root)
      ? JSON.parse(await readFile(resolve(root, 'src/planets', object.id, 'prepared/runtime.json'), 'utf8'))
      : requireRecord(await import(pathToFileURL(resolve(root, `src/planets/${object.id}/runtime/definition.mjs`)).href)).runtimeDefinition;
    results.push(await writeObjectJson(object.id, runtimeDefinition, options));
  }
  if (ids && results.length !== new Set(ids).size) throw new TypeError('A requested object has no registered JSON descriptor.');
  // Contexts consume finalized body frames. Preparing them first can retain a
  // previous radius and make an otherwise valid destination fail at handoff.
  const { prepareSpatialContext } = await import('./objects/dist/prepare-spatial-context.js');
  for (const object of OBJECTS) {
    const directory = resolve(root, 'src/planets', object.id);
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
  const ids = process.argv.slice(2);
  for (const result of await prepareObjectJson(ids.length ? ids : null)) console.log(JSON.stringify(result));
}
