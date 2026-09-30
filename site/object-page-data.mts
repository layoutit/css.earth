import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { parseObjectDescriptor } from '@cssearth/objects';
import { preparedObjectText, preparedPageData } from '@cssearth/objects/node';
import { requireAssets, requireControls } from '@cssearth/renderer';
import { isRecord } from '@cssearth/core';
import { resolveSceneAddressesDeep } from './asset-origin.mts';

/** Server/build-only metadata read. Scene trees remain separate runtime assets. */
export async function readPreparedObjectBytes(id: string, root = process.cwd()) {
  if (!/^[a-z][a-z0-9-]*$/u.test(id)) throw new TypeError('Invalid object page identity.');
  const directory = resolve(root, 'src/objects', id);
  const descriptor = parseObjectDescriptor(JSON.parse(await readFile(resolve(directory, 'object.json'), 'utf8')));
  if (descriptor.id !== id || descriptor.prepared?.url !== 'prepared/object.json') {
    throw new TypeError(`${id}: invalid prepared page reference.`);
  }
  // The transport is built from the restored runtime when read; no copy is kept on disk (prepared-transport.ts).
  const bytes = Buffer.from(await preparedObjectText(directory, descriptor));
  return { descriptor, bytes };
}

export async function loadObjectPageData(id: string, root = process.cwd()) {
  if (!/^[a-z][a-z0-9-]*$/u.test(id)) throw new TypeError('Invalid object page identity.');
  const directory = resolve(root, 'src/objects', id);
  const descriptor = parseObjectDescriptor(JSON.parse(await readFile(resolve(directory, 'object.json'), 'utf8')));
  const page = descriptor.properties.page;
  const reference = isRecord(page) && isRecord(page.metadata) ? page.metadata : null;
  if (descriptor.id !== id || reference?.url !== 'prepared/page.json') {
    throw new TypeError(`${id}: invalid prepared page reference.`);
  }
  // The page data is the runtime's asset table and its published controls, read when needed (prepared-transport.ts).
  const object: unknown = await preparedPageData(directory, id);
  if (!isRecord(object) || object.schema !== 'cssearth-object-page@1' || object.id !== id || !object.assets || !object.controls) {
    throw new TypeError(`${id}: incomplete prepared page data.`);
  }
  requireAssets(object.assets);
  requireControls(object.controls);
  // `DatasetList.astro` and its sibling result/overview components read dataset thumbnail and
  // dataset-preview addresses straight off this data, outside the runtime `resources.url()`
  // chokepoint (`prepared-residency.ts`) and outside `PreparedObjectHead`'s preload list.
  return { descriptor, assets: await resolveSceneAddressesDeep(object.assets, root), controls: await resolveSceneAddressesDeep(object.controls, root) };
}
