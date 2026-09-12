import type { ObjectRuntimeDefinition } from './runtime/object-runtime-types.js';
import { decodePreparedCssObject, decodeSharedBank, requirePreparedCssDescriptor } from './prepared-object-decoder.js';
import type { SharedReference } from './prepared-object-decoder.js';
import { decodePreparedObjectInWorker } from './prepared-object-worker-client.js';

export { PREPARED_CSS_OBJECT_FORMAT, decodeSharedBank } from './prepared-object-decoder.js';
export type { SharedReference } from './prepared-object-decoder.js';
export interface PreparedCssTransport {
  /** Return the exact bytes addressed by the prepared reference. The decoder
   * owns this buffer and may transfer it to a worker. */
  read(url: string, signal?: AbortSignal): Promise<ArrayBuffer>;
  /** Bytes of one content-addressed shared bank, for decoding on this thread. */
  readShared?(reference: SharedReference, signal?: AbortSignal): Promise<ArrayBuffer>;
  /** Base URL the browser worker fetches shared banks from as `<sharedUrl>/<kind>/<sha256>.json`. */
  sharedUrl?: string;
}

/** Decode a pinned artifact. Runtime never bakes a missing or stale payload. */
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
  if (typeof Worker === 'undefined') {
    const readShared = transport.readShared?.bind(transport);
    return decodePreparedCssObject(descriptor, bytes, readShared
      ? { readSharedBank: async reference => decodeSharedBank(reference, await readShared(reference, signal)) } : {});
  }
  return decodePreparedObjectInWorker({ descriptor, bytes, ...(transport.sharedUrl === undefined ? {} : { sharedUrl: transport.sharedUrl }) }, { signal });
}
