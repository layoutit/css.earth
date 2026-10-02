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
