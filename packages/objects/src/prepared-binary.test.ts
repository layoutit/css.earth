import { expect, test } from 'vitest';
import { gzipSync } from 'node:zlib';
import { shufflePreparedBinary, unshufflePreparedBinary } from './prepared-binary.js';
import { packPreparedBinary, unpackPreparedBinary } from './node/prepared-binary-file.js';

const file = () => {
  const bytes = new Uint8Array(64);
  new DataView(bytes.buffer).setFloat64(8, Math.PI, true);
  new Int32Array(bytes.buffer, 16, 8).set([1, -2, 3, 400000, -5, 6, 7, 8]);
  bytes.set([9, 8, 7], 48);
  return { bytes, regions: [{ offset: 8, bytes: 8, elementBytes: 8 }, { offset: 16, bytes: 32, elementBytes: 4 }] };
};

test('a packed file unpacks to exactly its original bytes', () => {
  const { bytes, regions } = file();
  const shuffled = shufflePreparedBinary(bytes, regions);
  expect(new Uint8Array(unshufflePreparedBinary(shuffled))).toEqual(bytes);
  const packed = packPreparedBinary(bytes, regions);
  expect(packPreparedBinary(bytes, regions), 'the same bytes pack to the same file').toEqual(packed);
  expect(new Uint8Array(unpackPreparedBinary(packed))).toEqual(bytes);
});

test('a packed file refuses bad regions, a plain file and a lying header', () => {
  const { bytes } = file();
  expect(() => shufflePreparedBinary(bytes, [{ offset: 60, bytes: 8, elementBytes: 4 }], 'x.bin')).toThrow(/x.bin: prepared binary region .* must lie inside the file's 64 bytes/u);
  expect(() => shufflePreparedBinary(bytes, [{ offset: 8, bytes: 6, elementBytes: 4 }], 'x.bin')).toThrow(/whole elements/u);
  expect(() => shufflePreparedBinary(bytes, [{ offset: 8, bytes: 8, elementBytes: 8 }, { offset: 12, bytes: 4, elementBytes: 4 }], 'x.bin')).toThrow(/after the region before it/u);
  expect(() => unpackPreparedBinary(bytes, 'x.bin')).toThrow(/x.bin: a prepared binary file is gzip-compressed; this one starts 0, 0/u);
  expect(() => unpackPreparedBinary(new Uint8Array(gzipSync(Buffer.from('not a container'))), 'x.bin')).toThrow(/x.bin: not a prepared binary container/u);
  const shuffled = shufflePreparedBinary(bytes, []);
  expect(() => unshufflePreparedBinary(shuffled.subarray(0, shuffled.length - 1), 'x.bin')).toThrow(/holds 63 bytes after its 0 regions; its header says 64/u);
});
