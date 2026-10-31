import { test, mock } from 'node:test';
import assert from 'node:assert/strict';
import { encodeCloudPoints, type PreparedBank, type PreparedCloudPoints } from '@cssearth/objects';

let fixture: PreparedBank | undefined;
mock.module('../../prepared-data/prepared-readers.js', { namedExports: {
  fetchPreparedBank: async () => { if (!fixture) throw new Error('No fixture.'); return fixture; },
  preparedReader: (kind: string, read: unknown) => ({ kind, read }),
} });
const { cloudOverlayReader } = await import('./cloud-overlay-reader.js');

test('the worker transfers each fixed cloud column buffer once, whether separate or shared', async () => {
  const cloud: PreparedCloudPoints = { id: 'dust', count: 1,
    frame: { referenceFrame: 'fixture', epochJdTt: 1, originM: [0, 0, 0], localToReferenceXyzw: [0, 0, 0, 1], metersPerUnit: 1,
      boundsUnits: { min: [-1, -1, -1], max: [1, 1, 1] } },
    positions: Float64Array.from([0, 0, 0]), diameters: Float32Array.from([1]), cells: Uint16Array.from([0, 0]),
    atlas: 'dust.webp', cellTexels: 32, occluder: [] };
  for (const data of [cloud, { ...cloud, cells: new Uint16Array(cloud.diameters.buffer) }]) {
    fixture = encodeCloudPoints(data);
    const reading = await cloudOverlayReader.read('/dust.bin', fetch);
    assert.equal(reading.value.kind, 'points');
    if (reading.value.kind !== 'points') throw new Error('Not points.');
    assert.deepEqual(reading.value.points.cells, data.cells);
    const expected = new Set([data.positions.buffer, data.diameters.buffer, data.cells.buffer]);
    assert.deepEqual(new Set(reading.transfer), expected);
    assert.equal(reading.transfer.length, expected.size, 'each shared buffer is transferred once');
  }
});
