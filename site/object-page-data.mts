import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { parseObjectDescriptor } from '@cssearth/objects';
import { requireAssets, requireControls } from '../src/renderers/css/dist/index.js';
import { record } from './browser-types.mts';
import { resolveSceneAddressesDeep } from './asset-origin.mts';

/** Server/build-only metadata read. Scene trees remain separate runtime assets. */
export async function readPreparedObjectBytes(id: string, root = process.cwd()) {
  if (!/^[a-z][a-z0-9-]*$/u.test(id)) throw new TypeError('Invalid object page identity.');
  const directory = resolve(root, 'src/objects', id);
  const descriptor = parseObjectDescriptor(JSON.parse(await readFile(resolve(directory, 'object.json'), 'utf8')));
  if (descriptor.id !== id || descriptor.prepared?.url !== 'prepared/object.json') {
    throw new TypeError(`${id}: invalid prepared page reference.`);
  }
  const bytes = await readFile(resolve(directory, 'prepared/object.json'));
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
  // page.json is written from the restored runtime by prepare:object-json.
  const bytes = await readFile(resolve(directory, reference.url));
  const object: unknown = JSON.parse(bytes.toString('utf8'));
  if (!record(object) || object.schema !== 'cssearth-object-page@1' || object.id !== id || !object.assets || !object.controls) {
    throw new TypeError(`${id}: incomplete prepared page data.`);
  }
  requireAssets(object.assets);
  requireControls(object.controls);
  // `DatasetLenses.astro` and its sibling result/overview components read lens thumbnail and
  // dataset-preview addresses straight off this data, outside the runtime `resources.url()`
  // chokepoint (`prepared-residency.ts`) and outside `PreparedObjectHead`'s preload list.
  return { descriptor, assets: await resolveSceneAddressesDeep(object.assets, root), controls: await resolveSceneAddressesDeep(object.controls, root) };
}
