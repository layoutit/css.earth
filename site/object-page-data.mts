import { sha256 } from '../src/platform/sha256.mts';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { parseObjectDescriptor } from '@cssearth/objects';
import { requireAssets, requireControls } from '../src/renderers/css/dist/index.js';
import { record } from './browser-types.mts';

/** Server/build-only metadata read. Scene trees remain separate runtime assets. */
export async function readPreparedObjectBytes(id: string, root = process.cwd()) {
  if (!/^[a-z][a-z0-9-]*$/u.test(id)) throw new TypeError('Invalid object page identity.');
  const directory = resolve(root, 'src/objects', id);
  const descriptor = parseObjectDescriptor(JSON.parse(await readFile(resolve(directory, 'object.json'), 'utf8')));
  if (descriptor.id !== id || descriptor.prepared?.url !== 'prepared/object.json') {
    throw new TypeError(`${id}: invalid prepared page reference.`);
  }
  const bytes = await readFile(resolve(directory, 'prepared/object.json'));
  if (sha256(bytes) !== descriptor.prepared.sha256) {
    throw new Error(`${id}: prepared page data differs from its descriptor pin.`);
  }
  return { descriptor, bytes };
}

export async function loadObjectPageData(id: string, root = process.cwd()) {
  if (!/^[a-z][a-z0-9-]*$/u.test(id)) throw new TypeError('Invalid object page identity.');
  const directory = resolve(root, 'src/objects', id);
  const descriptor = parseObjectDescriptor(JSON.parse(await readFile(resolve(directory, 'object.json'), 'utf8')));
  const page = descriptor.properties.page;
  const reference = record(page) && record(page.metadata) ? page.metadata : null;
  if (descriptor.id !== id || reference?.url !== 'prepared/page.json') {
    throw new TypeError(`${id}: invalid prepared page reference.`);
  }
  const bytes = await readFile(resolve(directory, reference.url));
  if (sha256(bytes) !== reference.sha256) {
    throw new Error(`${id}: prepared page data differs from its descriptor pin.`);
  }
  const object: unknown = JSON.parse(bytes.toString('utf8'));
  if (!record(object) || object.schema !== 'cssearth-object-page@1' || object.id !== id ||
      object.sceneSha256 !== descriptor.prepared?.sha256 || !object.assets || !object.controls) {
    throw new TypeError(`${id}: incomplete prepared page data.`);
  }
  requireAssets(object.assets);
  requireControls(object.controls);
  return { assets: object.assets, controls: object.controls };
}
