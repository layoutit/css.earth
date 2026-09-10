import {requireRecord} from './source-values.mts';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { OBJECTS } from '../site/objects.mts';
import { serializeObjectJson } from './prepare-object-json.mts';
import { writePreparedText } from './write-prepared-text.mts';

const projectRoot = fileURLToPath(new URL('../', import.meta.url));

/** Restore only pinned JSON transports; never prepare geometry, bindings or assets. */
export async function restoreObjectJson(ids = OBJECTS.map(({ id }) => id), root = projectRoot) {
  if (new Set(ids).size !== ids.length || ids.some(id => !OBJECTS.some(object => object.id === id))) {
    throw new TypeError('Choose registered object ids.');
  }
  let written = 0;
  for (const id of ids) {
    const directory = resolve(root, 'src/planets', id);
    const descriptor = requireRecord(JSON.parse(await readFile(resolve(directory, 'object.json'), 'utf8')));
    const reference = requireRecord(descriptor.prepared);
    if (descriptor.id !== id || reference?.url !== 'prepared/object.json' ||
        reference?.format !== 'cssearth-css-object@4') {
      throw new TypeError(`${id}: invalid prepared JSON reference.`);
    }
    const runtime: unknown = JSON.parse(await readFile(resolve(directory, 'prepared/runtime.json'), 'utf8'));
    const payload = serializeObjectJson(descriptor, runtime);
    if (createHash('sha256').update(payload).digest('hex') !== reference.sha256) {
      throw new Error(`${id}: checked-in runtime does not reproduce its prepared JSON pin.`);
    }
    if (await writePreparedText(resolve(directory, reference.url), payload)) written++;
  }
  return { objects: ids.length, written, reused: ids.length - written };
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const ids = process.argv.slice(2);
  console.log(JSON.stringify(await restoreObjectJson(ids.length ? ids : undefined)));
}
