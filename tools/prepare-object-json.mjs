import { createHash } from 'node:crypto';
import { access, mkdir, readFile } from 'node:fs/promises';
import { resolve, sep } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { OBJECTS } from '../site/objects.mjs';
import { authoredObject } from './authored-object.mjs';
import { preparePresentationBindings } from './prepared-presentation-bindings.mjs';
import { writePreparedText } from './write-prepared-text.mjs';
import { prepareMarkerBindings } from './prepare-marker-bindings.mjs';

const root = fileURLToPath(new URL('../', import.meta.url));
const format = 'cssearth-css-object@4';

export function serializeObjectJson(descriptor, definition) {
  if (descriptor.schema !== 'cssearth-object@1' || typeof descriptor.type !== 'string' ||
      definition.id !== descriptor.id || definition.schema !== 'cssearth-object-runtime@4') {
    throw new TypeError('Prepared object identity does not match its descriptor.');
  }
  return JSON.stringify({ schema: 'cssearth-prepared-object@1', id: descriptor.id,
    type: descriptor.type, format, data: definition });
}

export async function writeObjectJson(id, definition, options) {
  if (!OBJECTS.some(object => object.id === id) || definition.id !== id || definition.schema !== 'cssearth-object-runtime@4') {
    throw new TypeError('Prepared object identity does not match the application registry.');
  }
  const descriptorPath = resolve(root, 'src/planets', id, 'object.json');
  let descriptor = JSON.parse(await readFile(descriptorPath, 'utf8'));
  if (descriptor.schema !== 'cssearth-object@1' || descriptor.id !== id || typeof descriptor.type !== 'string') {
    throw new TypeError('Prepared object descriptor identity is invalid.');
  }
  const { prepareWorldNavigationDefinition, writeWorldNavigationArtifacts } = await import('./objects/dist/prepare-world-navigation.js');
  const objectDirectory = resolve(root, 'src/planets', id);
  definition = prepareMarkerBindings(definition);
  const preparedNavigation = await prepareWorldNavigationDefinition({ objectDirectory, definition, projectRoot: root });
  definition = preparedNavigation.definition;
  definition = await preparePresentationBindings(definition, root, options);
  const scene = JSON.parse(await readFile(resolve(objectDirectory, 'prepared/scene.json'), 'utf8'));
  await writeWorldNavigationArtifacts(resolve(objectDirectory, 'prepared'), { ...preparedNavigation, definition }, scene);
  descriptor = { ...descriptor, properties: { ...descriptor.properties, worldFrame: preparedNavigation.frame } };
  const payload = serializeObjectJson(descriptor, definition);
  const asset = resolve(root, 'src/planets', id, 'prepared/object.json');
  await mkdir(resolve(root, 'src/planets', id, 'prepared'), { recursive: true });
  await writePreparedText(asset, payload);
  const prepared = { format, url: 'prepared/object.json', sha256: createHash('sha256').update(payload).digest('hex') };
  await writePreparedText(descriptorPath, `${JSON.stringify({ ...descriptor, prepared }, null, 2)}\n`);
  return { id, bytes: Buffer.byteLength(payload), ...prepared };
}

/** Existing descriptors opt into JSON baking; planned objects get no fallback. */
export async function updateObjectJsonForPresentation(target, presentation, controls) {
  const file = target instanceof URL ? fileURLToPath(target) : resolve(target);
  const match = file.split(sep).join('/').match(/\/src\/planets\/([a-z][a-z0-9-]*)\/runtime\/preparedPresentation\.mjs$/);
  if (!match) return null;
  const id = match[1];
  try { await access(resolve(root, 'src/planets', id, 'object.json')); }
  catch (error) { if (error.code === 'ENOENT') return null; throw error; }
  return writeObjectJson(id, { ...presentation, schema: 'cssearth-object-runtime@4', id, controls });
}

export async function prepareObjectJson(ids, options) {
  const results = [];
  for (const object of OBJECTS) {
    if (ids && !ids.includes(object.id)) continue;
    try { await access(resolve(root, 'src/planets', object.id, 'object.json')); }
    catch (error) { if (error.code === 'ENOENT' && !ids) continue; throw error; }
    const runtimeDefinition = await authoredObject(object.id, root)
      ? JSON.parse(await readFile(resolve(root, 'src/planets', object.id, 'prepared/runtime.json'), 'utf8'))
      : (await import(pathToFileURL(resolve(root, `src/planets/${object.id}/runtime/definition.mjs`)).href)).runtimeDefinition;
    results.push(await writeObjectJson(object.id, runtimeDefinition, options));
  }
  if (ids && results.length !== new Set(ids).size) throw new TypeError('A requested object has no registered JSON descriptor.');
  // Contexts consume finalized body frames. Preparing them first can retain a
  // previous radius and make an otherwise valid destination fail at handoff.
  const { prepareSpatialContext } = await import('./objects/dist/prepare-spatial-context.js');
  for (const object of OBJECTS) {
    const directory = resolve(root, 'src/planets', object.id);
    const descriptor = JSON.parse(await readFile(resolve(directory, 'object.json'), 'utf8'));
    const source = descriptor.properties?.recipe?.sources?.find(source => source.id === 'world-context');
    if (!source) continue;
    await prepareSpatialContext({ sourcePath: resolve(directory, source.path),
      outputPath: resolve(directory, 'prepared/world-context.json'),
      solarGeometryPath: resolve(root, 'src/platform/solar-geometry.mjs') });
  }
  return results;
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const ids = process.argv.slice(2);
  for (const result of await prepareObjectJson(ids.length ? ids : null)) console.log(JSON.stringify(result));
}
