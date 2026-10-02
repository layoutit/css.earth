import { test } from 'node:test';
import assert from 'node:assert/strict';
import { catalogueCells } from '@cssearth/objects';
import { packPreparedBinary, unpackPreparedBinary } from '@cssearth/objects/node';
import { decodeCatalogueBankBinary, encodeCatalogueBankBinary } from '@cssearth/objects';

test('a catalogue bank decodes to exactly the JSON it was, and refuses positions that would not', () => {
  const points = [[1.2345, -6932.1, 0, 2], [0.0001, 198.4, -25.47, 0], [-1e-4, 3, 4, 300]];
  const bank = { schema: 'cssearth-catalogue-points@1', id: 'b', appearance: { palette: ['#fff'] }, spread: { normal: [0, 0, 1], across: 1, along: 0 },
    points, cells: catalogueCells(points) };
  const { bytes, regions } = encodeCatalogueBankBinary(bank, 'b');
  const decoded = decodeCatalogueBankBinary(unpackPreparedBinary(packPreparedBinary(bytes, regions)), 'b');
  assert.deepEqual(decoded, bank);
  assert.equal(JSON.stringify(decoded.points), JSON.stringify(points));
  assert.throws(() => encodeCatalogueBankBinary({ ...bank, points: [[1.23456, 0, 0, 0], ...points.slice(1)] }, 'm31: bank dots'), /m31: bank dots: point 0 axis x is 1.23456, which is not a whole number of 1e-4 units/u);
  assert.throws(() => encodeCatalogueBankBinary({ ...bank, cells: { ...bank.cells, of: [0] } }, 'b'), /b: a published bank needs its cells, one per point/u);
  assert.throws(() => decodeCatalogueBankBinary(new ArrayBuffer(16), 'b.bin'), /b.bin: not a catalogue point bank/u);
});
