import type { ObjectRuntimeDefinition } from './runtime/object-runtime-types.js';
import { decodePreparedCssObject, requirePreparedCssDescriptor } from './prepared-object-decoder.js';
import { decodePreparedObjectInWorker } from './prepared-object-worker-client.js';

export { PREPARED_CSS_OBJECT_FORMAT } from './prepared-object-decoder.js';
export interface PreparedCssTransport {
  /** Return the exact bytes addressed by the prepared reference. The decoder
   * owns this buffer and may transfer it to a worker. */
  read(url: string, signal?: AbortSignal): Promise<ArrayBuffer>;
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
  if (typeof Worker === 'undefined') return decodePreparedCssObject(descriptor, bytes);
  return decodePreparedObjectInWorker({ descriptor, bytes }, { signal });
}
