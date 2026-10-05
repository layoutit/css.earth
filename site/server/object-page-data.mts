import { OBJECT_PAGE_SCHEMA, parseObjectDescriptor, type ObjectDescriptor, deferredDatasetIds, parsePreparedObjectRuntime, requireAssets, requireControls, splitPreparedDatasetTables } from '@cssearth/objects';

import { readFile, stat } from 'node:fs/promises';
import { resolve } from 'node:path';

import { preparedObjectText, preparedObjectTransport, preparedPageData } from '@cssearth/objects/node';

import { isRecord } from '@cssearth/core';
import { resolveSceneAddressesDeep } from '../server-assets/asset-origin.mts';

interface PreparedTransports { readonly descriptor: ObjectDescriptor; readonly object: Buffer<ArrayBuffer>; readonly datasets: ReadonlyMap<string, Buffer<ArrayBuffer>> }
// The dataset routes read one body's transports in turn: its split is kept for the next request, not rebuilt per file.
const recent = new Map<string, Promise<PreparedTransports>>(), RECENT = 4;

/** A scene body's transports, built from its restored runtime when read; no copy is kept on disk (prepared-transport.ts).
 * A body with one dataset is served as its runtime. A body with several carries its default dataset's tables, and each
 * other dataset's tables are a transport of their own (dataset-tables.ts in `@cssearth/objects`). */
async function preparedTransports(id: string, root: string): Promise<PreparedTransports> {
  if (!/^[a-z][a-z0-9-]*$/u.test(id)) throw new TypeError('Invalid object page identity.');
  // A rebake during development changes the runtime under the same id.
  const key = `${resolve(root)}\0${id}\0${(await stat(resolve(root, 'src/objects', id, 'prepared/runtime.json'))).mtimeMs}`;
  let transports = recent.get(key);
  if (!transports) {
    transports = (async () => {
      const directory = resolve(root, 'src/objects', id);
      const descriptor = parseObjectDescriptor(JSON.parse(await readFile(resolve(directory, 'object.json'), 'utf8')) as unknown);
      if (descriptor.id !== id || descriptor.prepared?.url !== 'prepared/object.json') {
        throw new TypeError(`${id}: invalid prepared page reference.`);
      }
      if (!deferredDatasetIds(await preparedControls(directory)).length) {
        return { descriptor, object: Buffer.from(await preparedObjectText(directory, descriptor)), datasets: new Map() };
      }
      const runtime = parsePreparedObjectRuntime(JSON.parse(await readFile(resolve(directory, 'prepared/runtime.json'), 'utf8')), { parsedJson: true });
      const { definition, tables } = splitPreparedDatasetTables(runtime);
      return { descriptor, object: Buffer.from(preparedObjectTransport(descriptor, JSON.stringify(definition))),
        datasets: new Map(tables.map(table => [table.datasetId, Buffer.from(JSON.stringify(table))])) };
    })();
    recent.set(key, transports);
    transports.catch(() => { if (recent.get(key) === transports) recent.delete(key); });
    for (const old of recent.keys()) if (recent.size > RECENT) recent.delete(old);
  }
  return transports;
}

/** A scene body's published controls, which are its runtime's (prepared-transport.ts). */
async function preparedControls(directory: string) {
  const controls: unknown = JSON.parse(await readFile(resolve(directory, 'prepared/controls.json'), 'utf8'));
  requireControls(controls);
  return controls;
}

/** The bank a scene body's default dataset shows (a galaxy's image layers, a nebula's volume), or null: the page's head
 * asks for that bank's file list with the page (`startup-requests.mts`), so the first image does not wait a round trip. */
export async function defaultDatasetBank(id: string, root = process.cwd()): Promise<string | null> {
  if (!/^[a-z][a-z0-9-]*$/u.test(id)) throw new TypeError('Invalid object page identity.');
  const controls = await preparedControls(resolve(root, 'src/objects', id)).catch(error => {
    if (error && typeof error === 'object' && 'code' in error && error.code === 'ENOENT') return null;
    throw error;
  });
  const datasets = controls?.datasets;
  const volume = datasets?.controls.find(dataset => dataset.id === datasets.defaultDataset)?.volume;
  return volume?.objectId ?? null;
}

/** The ids of the datasets whose tables a scene body serves apart (`/objects/<id>/datasets/<dataset>.json`). */
export async function preparedDatasetIds(id: string, root = process.cwd()) {
  if (!/^[a-z][a-z0-9-]*$/u.test(id)) throw new TypeError('Invalid object page identity.');
  return deferredDatasetIds(await preparedControls(resolve(root, 'src/objects', id)));
}

/** Server/build-only metadata read. Scene trees remain separate runtime assets. */
export async function readPreparedObjectBytes(id: string, root = process.cwd()) {
  const { descriptor, object } = await preparedTransports(id, root);
  return { descriptor, bytes: object };
}

/** The transport of one deferred dataset's tables. */
export async function readPreparedDatasetBytes(id: string, datasetId: string, root = process.cwd()) {
  const bytes = (await preparedTransports(id, root)).datasets.get(datasetId);
  if (!bytes) throw new RangeError(`${id}: dataset ${datasetId} has no transport of its own.`);
  return bytes;
}

export async function loadObjectPageData(id: string, root = process.cwd()) {
  if (!/^[a-z][a-z0-9-]*$/u.test(id)) throw new TypeError('Invalid object page identity.');
  const directory = resolve(root, 'src/objects', id);
  const descriptor = parseObjectDescriptor(JSON.parse(await readFile(resolve(directory, 'object.json'), 'utf8')) as unknown);
  const page = descriptor.properties.page;
  const reference = isRecord(page) && isRecord(page.metadata) ? page.metadata : null;
  if (descriptor.id !== id || reference?.url !== 'prepared/page.json') {
    throw new TypeError(`${id}: invalid prepared page reference.`);
  }
  // The page data is the runtime's asset table and its published controls, read when needed (prepared-transport.ts).
  const object: unknown = await preparedPageData(directory, id);
  if (!isRecord(object) || object.schema !== OBJECT_PAGE_SCHEMA || object.id !== id || !object.assets || !object.controls) {
    throw new TypeError(`${id}: incomplete prepared page data.`);
  }
  requireAssets(object.assets);
  requireControls(object.controls);
  // `DatasetList.astro` and its sibling result/overview components read dataset thumbnail and
  // dataset-preview addresses straight off this data, outside the runtime `resources.url()`
  // chokepoint (`prepared-residency.ts`) and outside `PreparedObjectHead`'s preload list.
  return { descriptor, assets: await resolveSceneAddressesDeep(object.assets, root), controls: await resolveSceneAddressesDeep(object.controls, root) };
}
