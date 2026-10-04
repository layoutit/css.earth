import { unshufflePreparedBinary } from '@cssearth/objects';

/** A fetched prepared binary file's original bytes (@cssearth/objects prepared-binary.ts): gunzipped by the platform's
 * `DecompressionStream`, then unshuffled.
 *
 * The bytes are handed to the stream as they are. Wrapped in a Blob, they were read back through a loader, which WebKit
 * starts on the page's main thread even for a worker: every file cost a second request, and the Solar System's 41 orbit
 * banks made 82 in the first third of a second of a zoom out of Earth on an iPad (2026-10-04). */
export async function readPreparedBinary(compressed: ArrayBuffer | Uint8Array, at = 'prepared binary'): Promise<ArrayBuffer> {
  const bytes = compressed instanceof Uint8Array ? compressed : new Uint8Array(compressed);
  if (bytes[0] !== 0x1f || bytes[1] !== 0x8b) throw new TypeError(`${at}: a prepared binary file is gzip-compressed; this one starts ${bytes[0]}, ${bytes[1]}.`);
  // A byte view, never a bare ArrayBuffer: Node 22's stream never settles on one (the tests run there).
  const packed = compressed instanceof Uint8Array ? compressed.slice() : new Uint8Array(compressed);
  const stream = new ReadableStream<BufferSource>({ start(controller) { controller.enqueue(packed); controller.close(); } }).pipeThrough(new DecompressionStream('gzip'));
  return unshufflePreparedBinary(new Uint8Array(await new Response(stream).arrayBuffer()), at);
}
