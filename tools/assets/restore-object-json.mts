import { existsSync } from 'node:fs';
import {requireRecord} from '@cssearth/core';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { SCENE_OBJECTS } from '../../site/objects.mts';
import { serializeObjectJson } from '../prepare/prepare-object-json.mts';
import { preparePageMetadata } from '../prepared/prepared-page-metadata.mts';
import { writePreparedText } from '../prepared/write-prepared-text.mts';
import { PREPARED_CSS_OBJECT_FORMAT } from '../../src/renderers/css/dist/index.js';

const projectRoot = fileURLToPath(new URL('../../', import.meta.url));

/** Restore only pinned JSON transports; never prepare geometry, bindings or assets. */
export async function restoreObjectJson(ids = SCENE_OBJECTS.map(({ id }) => id), root = projectRoot, { restoredOnly = false } = {}) {
  if (new Set(ids).size !== ids.length || ids.some(id => !SCENE_OBJECTS.some(object => object.id === id))) {
    throw new TypeError('Choose registered object ids.');
  }
  let written = 0;
  let skipped = 0;
  for (const id of ids) {
    const directory = resolve(root, 'src/objects', id);
    const descriptor = requireRecord(JSON.parse(await readFile(resolve(directory, 'object.json'), 'utf8')));
    const reference = requireRecord(descriptor.prepared);
    if (descriptor.id !== id || reference?.url !== 'prepared/object.json' ||
        reference?.format !== PREPARED_CSS_OBJECT_FORMAT) {
      throw new TypeError(`${id}: invalid prepared JSON reference.`);
    }
    // `prepared/runtime.json` is restored from R2, and a checkout that deliberately restores no body
    // banks (the typecheck job) does not have every one. Skipping there leaves that body without a
    // derived page.json, which its consumers also skip; every other path restores first and still
    // fails loudly on a genuinely missing runtime.
    const runtimePath = resolve(directory, 'prepared/runtime.json');
    if (restoredOnly && !existsSync(runtimePath)) { skipped++; continue; }
    const runtime: unknown = JSON.parse(await readFile(runtimePath, 'utf8'));
    const payload = serializeObjectJson(descriptor, runtime);
    if (await writePreparedText(resolve(directory, reference.url), payload)) written++;
    // The page's assets and controls come from the same runtime, so a checkout never carries a stale copy.
    await writePreparedText(resolve(directory, 'prepared/page.json'), preparePageMetadata(id, runtime).text);
  }
  return { objects: ids.length, written, skipped, reused: ids.length - written - skipped };
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const args = process.argv.slice(2);
  const restoredOnly = args.includes('--restored-only');
  const ids = args.filter(arg => arg !== '--restored-only');
  console.log(JSON.stringify(await restoreObjectJson(ids.length ? ids : undefined, undefined, { restoredOnly })));
}
