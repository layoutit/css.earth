import { type ObjectRuntimeDefinition, preparedDatasetReference } from '@cssearth/objects';

import { decodePreparedCssObject, requirePreparedCssDescriptor } from './prepared-object-decoder.js';
import { decodePreparedObjectInWorker } from './prepared-object-worker-client.js';
import { adoptPreparedDatasetTables } from './prepared-data/dataset-tables.js';

export interface PreparedCssTransport {
  /** Return the exact bytes addressed by the prepared reference. The decoder
   * owns this buffer and may transfer it to a worker. */
  read(url: string, signal?: AbortSignal): Promise<ArrayBuffer>;
}

/** The transport each decoded definition came through, which also delivers its deferred datasets' tables. It is kept by
 * the definition's asset table: a mount adapts a copy of the definition (world-context-runtime.ts), and every copy shares
 * that table, whose identity adoption keeps. */
const datasetTransports = new WeakMap<ObjectRuntimeDefinition['assets'], { reference: string; transport: PreparedCssTransport; loads: Map<string, Promise<unknown>> }>();

/** Decode a prepared artifact. Runtime never bakes a missing or stale payload. */
export async function loadPreparedCssObject(
  descriptorInput: unknown,
  transport: PreparedCssTransport,
  { signal }: { signal?: AbortSignal } = {},
): Promise<ObjectRuntimeDefinition> {
  const descriptor = requirePreparedCssDescriptor(descriptorInput);
  signal?.throwIfAborted();
  const bytes = await (signal ? transport.read(descriptor.prepared!.url, signal) : transport.read(descriptor.prepared!.url));
  signal?.throwIfAborted();
  // Node preparation/tests have no browser Worker. Browser failures propagate;
  // they never silently repeat the expensive decode on the UI thread.
  const definition = typeof Worker === 'undefined' ? await decodePreparedCssObject(descriptor, bytes) : await decodePreparedObjectInWorker({ descriptor, bytes }, { signal });
  if (definition.deferredDatasets?.length) datasetTransports.set(definition.assets, { reference: descriptor.prepared!.url, transport, loads: new Map() });
  return definition;
}

/** Make a dataset's tables part of a definition (dataset-tables.ts): at once when they are, otherwise read through the
 * transport the definition came from and adopted. Every caller and copy waiting for one dataset shares one read, which
 * no caller's cancellation stops: a newer selection may want the same tables. A failed read is tried again next time. */
export async function loadPreparedDataset(definition: ObjectRuntimeDefinition, datasetId: string | null): Promise<void> {
  if (datasetId === null || !definition.deferredDatasets?.includes(datasetId)) return;
  const source = datasetTransports.get(definition.assets);
  if (!source) throw new Error(`${definition.id}: dataset ${datasetId} has no transport for its tables.`);
  let load = source.loads.get(datasetId);
  if (!load) {
    const reference = preparedDatasetReference(source.reference, datasetId);
    const read = load = source.transport.read(reference).then(bytes => {
      try { return JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes)) as unknown; }
      catch (cause) { throw new TypeError(`${definition.id}: ${reference} is not valid UTF-8 JSON.`, { cause }); }
    });
    source.loads.set(datasetId, read);
    read.catch(() => { if (source.loads.get(datasetId) === read) source.loads.delete(datasetId); });
  }
  const tables = await load;
  // Another caller waiting on this definition may have adopted them first.
  if (definition.deferredDatasets?.includes(datasetId)) adoptPreparedDatasetTables(definition, tables, datasetId);
}
