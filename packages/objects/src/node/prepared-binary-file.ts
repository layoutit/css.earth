// Packing and reading a prepared binary file at preparation (prepared-binary.ts): shuffled, then gzip level 9, which
// Node writes with a zero timestamp, so the same bytes pack to the same file.
import { gunzipSync, gzipSync } from 'node:zlib';
import { shufflePreparedBinary, unshufflePreparedBinary } from '../prepared-binary.js';
import type { PreparedBinaryRegion } from '../prepared-binary.js';

/** The file a prepared binary is published as. */
export function packPreparedBinary(bytes: Uint8Array, regions: readonly PreparedBinaryRegion[], at = 'prepared binary'): Uint8Array {
  return new Uint8Array(gzipSync(shufflePreparedBinary(bytes, regions, at), { level: 9 }));
}

/** A published prepared binary file's original bytes. */
export function unpackPreparedBinary(file: Uint8Array, at = 'prepared binary'): ArrayBuffer {
  if (file[0] !== 0x1f || file[1] !== 0x8b) throw new TypeError(`${at}: a prepared binary file is gzip-compressed; this one starts ${file[0]}, ${file[1]}.`);
  return unshufflePreparedBinary(new Uint8Array(gunzipSync(file)), at);
}
