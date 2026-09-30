import { expect, test } from 'vitest';
import { catalogueCells } from '@cssearth/objects';
import { packPreparedBinary, unpackPreparedBinary } from '@cssearth/objects/node';
import { decodeCatalogueBankBinary, encodeCatalogueBankBinary } from './catalogue-bank-binary.js';
import { readPreparedBinary } from './prepared-binary.js';

test('the page reads a packed file through the platform stream to exactly its original bytes', async () => {
  const bytes = Uint8Array.from({ length: 40 }, (_, index) => index * 7 % 256);
  const packed = packPreparedBinary(bytes, [{ offset: 8, bytes: 32, elementBytes: 4 }]);
  expect(new Uint8Array(await readPreparedBinary(packed, 'x.bin'))).toEqual(bytes);
  await expect(readPreparedBinary(bytes, 'x.bin')).rejects.toThrow(/x.bin: a prepared binary file is gzip-compressed; this one starts 0, 7/u);
});

test('a catalogue bank decodes to exactly the JSON it was, and refuses positions that would not', () => {
  const points = [[1.2345, -6932.1, 0, 2], [0.0001, 198.4, -25.47, 0], [-1e-4, 3, 4, 300]];
  const bank = { schema: 'cssearth-catalogue-points@1', id: 'b', appearance: { palette: ['#fff'] }, spread: { normal: [0, 0, 1], across: 1, along: 0 },
    points, cells: catalogueCells(points) };
  const { bytes, regions } = encodeCatalogueBankBinary(bank, 'b');
  const decoded = decodeCatalogueBankBinary(unpackPreparedBinary(packPreparedBinary(bytes, regions)), 'b');
  expect(decoded).toEqual(bank);
  expect(JSON.stringify(decoded.points)).toBe(JSON.stringify(points));
  expect(() => encodeCatalogueBankBinary({ ...bank, points: [[1.23456, 0, 0, 0], ...points.slice(1)] }, 'm31: bank dots'))
    .toThrow(/m31: bank dots: point 0 axis x is 1.23456, which is not a whole number of 1e-4 units/u);
  expect(() => encodeCatalogueBankBinary({ ...bank, cells: { ...bank.cells, of: [0] } }, 'b')).toThrow(/b: a published bank needs its cells, one per point/u);
  expect(() => decodeCatalogueBankBinary(new ArrayBuffer(16), 'b.bin')).toThrow(/b.bin: not a catalogue point bank/u);
});
