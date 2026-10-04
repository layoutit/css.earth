import { test } from 'node:test';
import assert from 'node:assert/strict';
import { packPreparedBinary } from '@cssearth/objects/node';
import { readPreparedBinary } from './prepared-binary.js';

test('the page reads a packed file through the platform stream to exactly its original bytes', async () => {
  const bytes = Uint8Array.from({ length: 40 }, (_, index) => index * 7 % 256);
  const packed = packPreparedBinary(bytes, [{ offset: 8, bytes: 32, elementBytes: 4 }]);
  assert.deepEqual((new Uint8Array(await readPreparedBinary(packed, 'x.bin'))), bytes);
  await assert.rejects(readPreparedBinary(bytes, 'x.bin'), /x.bin: a prepared binary file is gzip-compressed; this one starts 0, 7/u);
});

test('unpacking a file makes no Blob: a Blob is read back through a loader, a second request for every file', async () => {
  const bytes = Uint8Array.from({ length: 64 }, (_, index) => index * 3 % 256), packed = packPreparedBinary(bytes, [{ offset: 0, bytes: 64, elementBytes: 8 }]);
  const platform = globalThis.Blob;
  globalThis.Blob = class { constructor() { throw new Error('a Blob was made'); } } as unknown as typeof Blob;
  try { assert.deepEqual(new Uint8Array(await readPreparedBinary(packed.buffer.slice(packed.byteOffset, packed.byteOffset + packed.byteLength) as ArrayBuffer, 'x.bin')), bytes); }
  finally { globalThis.Blob = platform; }
});
