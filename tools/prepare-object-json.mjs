import { createHash } from 'node:crypto';
import { access, mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve, sep } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { OBJECTS } from '../site/objects.mjs';
import { authoredObject } from './authored-object.mjs';

const root = fileURLToPath(new URL('../', import.meta.url));
const format = 'cssearth-css-object@4';

export async function writeObjectJson(id, definition) {
  if (!OBJECTS.some(object => object.id === id) || definition.id !== id || definition.schema !== 'cssearth-object-runtime@4') {
    throw new TypeError('Prepared object identity does not match the application registry.');
  }
  const descriptorPath = resolve(root, 'src/planets', id, 'object.json');
  const descriptor = JSON.parse(await readFile(descriptorPath, 'utf8'));
  if (descriptor.schema !== 'cssearth-object@1' || descriptor.id !== id || typeof descriptor.type !== 'string') {
    throw new TypeError('Prepared object descriptor identity is invalid.');
  }
  const payload = JSON.stringify({ schema: 'cssearth-prepared-object@1', id,
    type: descriptor.type, format, data: definition });
  const asset = resolve(root, 'objects/prepared', `${id}.json`);
  await mkdir(resolve(root, 'objects/prepared'), { recursive: true });
  await writeFile(asset, payload);
  const prepared = { format, url: `prepared/${id}.json`, sha256: createHash('sha256').update(payload).digest('hex') };
  await writeFile(descriptorPath, `${JSON.stringify({ ...descriptor, prepared }, null, 2)}\n`);
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

export async function prepareObjectJson(ids) {
  const results = [];
  for (const object of OBJECTS) {
    if (ids && !ids.includes(object.id)) continue;
    try { await access(resolve(root, 'src/planets', object.id, 'object.json')); }
    catch (error) { if (error.code === 'ENOENT' && !ids) continue; throw error; }
    const runtimeDefinition = await authoredObject(object.id, root)
      ? JSON.parse(await readFile(resolve(root, 'objects/preparation', object.id, 'runtime.json'), 'utf8'))
      : (await import(pathToFileURL(resolve(root, `src/planets/${object.id}/runtime/definition.mjs`)).href)).runtimeDefinition;
    results.push(await writeObjectJson(object.id, runtimeDefinition));
  }
  if (ids && results.length !== new Set(ids).size) throw new TypeError('A requested object has no registered JSON descriptor.');
  return results;
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const ids = process.argv.slice(2);
  for (const result of await prepareObjectJson(ids.length ? ids : null)) console.log(JSON.stringify(result));
}
