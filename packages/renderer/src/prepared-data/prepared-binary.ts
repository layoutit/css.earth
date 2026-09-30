import { unshufflePreparedBinary } from '@cssearth/objects';

/** A fetched prepared binary file's original bytes (@cssearth/objects prepared-binary.ts): gunzipped by the platform's
 * `DecompressionStream`, then unshuffled. */
export async function readPreparedBinary(compressed: ArrayBuffer | Uint8Array, at = 'prepared binary'): Promise<ArrayBuffer> {
  const bytes = compressed instanceof Uint8Array ? compressed : new Uint8Array(compressed);
  if (bytes[0] !== 0x1f || bytes[1] !== 0x8b) throw new TypeError(`${at}: a prepared binary file is gzip-compressed; this one starts ${bytes[0]}, ${bytes[1]}.`);
  const stream = new Blob([compressed instanceof Uint8Array ? compressed.slice() : compressed]).stream().pipeThrough(new DecompressionStream('gzip'));
  return unshufflePreparedBinary(new Uint8Array(await new Response(stream).arrayBuffer()), at);
}
