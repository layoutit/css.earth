import type { ObjectRuntimeDefinition } from './runtime/object-runtime-types.js';
import { decodePreparedCssObject, requirePreparedCssDescriptor } from './prepared-object-decoder.js';
import { decodePreparedObjectInWorker } from './prepared-object-worker-client.js';
import { adoptPreparedDatasetTables, preparedDatasetReference } from './prepared-data/dataset-tables.js';

export { PREPARED_CSS_OBJECT_FORMAT } from './prepared-object-decoder.js';
export interface PreparedCssTransport {
  /** Return the exact bytes addressed by the prepared reference. The decoder
   * owns this buffer and may transfer it to a worker. */
  read(url: string, signal?: AbortSignal): Promise<ArrayBuffer>;
}

/** The transport each decoded definition came through, which also delivers its deferred datasets' tables. */
const datasetTransports = new WeakMap<ObjectRuntimeDefinition, { reference: string; transport: PreparedCssTransport; loads: Map<string, Promise<void>> }>();

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
  if (definition.deferredDatasets?.length) datasetTransports.set(definition, { reference: descriptor.prepared!.url, transport, loads: new Map() });
  return definition;
}

/** Make a dataset's tables part of its definition (dataset-tables.ts): at once when they are, otherwise read through
 * the transport the definition came from and adopted. Every caller waiting for one dataset shares one read, which no
 * caller's cancellation stops: a newer selection may want the same tables. A failed read is tried again next time. */
export function loadPreparedDataset(definition: ObjectRuntimeDefinition, datasetId: string | null): Promise<void> {
  if (datasetId === null || !definition.deferredDatasets?.includes(datasetId)) return Promise.resolve();
  const source = datasetTransports.get(definition);
  if (!source) return Promise.reject(new Error(`${definition.id}: dataset ${datasetId} has no transport for its tables.`));
  let load = source.loads.get(datasetId);
  if (!load) {
    const reference = preparedDatasetReference(source.reference, datasetId);
    load = source.transport.read(reference).then(bytes => {
      let tables: unknown;
      try { tables = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes)); }
      catch (cause) { throw new TypeError(`${definition.id}: ${reference} is not valid UTF-8 JSON.`, { cause }); }
      // A concurrent read of the same tables may have adopted them first.
      if (definition.deferredDatasets?.includes(datasetId)) adoptPreparedDatasetTables(definition, tables, datasetId);
    });
    source.loads.set(datasetId, load);
    load.catch(() => { if (source.loads.get(datasetId) === load) source.loads.delete(datasetId); });
  }
  return load;
}
