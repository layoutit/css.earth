import { test } from 'node:test';
import assert from 'node:assert/strict';
import { decodePreparedBank, encodePreparedBank, type PreparedBank } from '../../prepared-bank.js';
import { encodeCloudPoints, readCloudPoints, type PreparedCloudPoints } from './cloud-points.js';

const frame = { referenceFrame: 'icrf', epochJdTt: 1, originM: [0, 0, 0], localToReferenceXyzw: [0, 0, 0, 1],
  metersPerUnit: 100, boundsUnits: { min: [-1, -1, -1], max: [1, 1, 1] } } as const;
const ellipsoid = { centreUnits: [0, 0, 0], axesUnits: [[.5, 0, 0], [0, .25, 0], [0, 0, .25]] } as const;
const cloud = (): PreparedCloudPoints => ({ id: 'outer-ejecta', frame: frame as never, count: 2,
  positions: Float64Array.from([.1, -.2, .3, -.4, .5, -.6]), diameters: Float32Array.from([.05, .125]), cells: Uint16Array.from([0, 0, 64, 0]),
  atlas: 'outer-ejecta.webp', cellTexels: 64, occluder: [ellipsoid] });
/** Through the bank's bytes, as the bake writes them and the page reads them. */
const travel = (bank: PreparedBank) => {
  const { bytes } = encodePreparedBank(bank, 'cloud.bin');
  return decodePreparedBank(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer, 'cloud.bin');
};
const plain = (c: PreparedCloudPoints) => ({ ...c, positions: [...c.positions], diameters: [...c.diameters], cells: [...c.cells] });

test('cloud points travel through a bank file and read back to every billboard, its atlas and its occluder', () => {
  const read = readCloudPoints(travel(encodeCloudPoints(cloud())), 'cloud.bin');
  assert.deepEqual(plain(read), plain(cloud()));
  assert.equal(read.positions[0], .1, 'a place keeps every digit');
});

test('a bank that is not cloud points, or whose billboards, atlas or occluder are malformed, is refused by name', () => {
  const bank = encodeCloudPoints(cloud());
  const fields = (patch: Record<string, unknown>) => ({ ...bank, fields: { ...bank.fields, ...patch } });
  const columns = (patch: Record<string, unknown>) => ({ ...bank, columns: { ...bank.columns, ...patch } }) as PreparedBank;
  assert.throws(() => readCloudPoints({ ...bank, schema: 'cssearth-cloud-segments@1' }, 'cloud.bin'), /cloud.bin: expected cssearth-cloud-points@1/u);
  for (const id of ['Outer', '1st', '', undefined]) assert.throws(() => readCloudPoints(fields({ id }), 'cloud.bin'), /cloud.bin: its id is a bank id/u, String(id));
  assert.throws(() => readCloudPoints(fields({ count: -1 }), 'cloud.bin'), /count is a count/u);
  for (const atlas of ['../atlas.webp', 'Atlas.webp', 'a/b.webp', 3]) assert.throws(() => readCloudPoints(fields({ atlas }), 'cloud.bin'), /cloud.bin: atlas is a prepared file name/u, String(atlas));
  for (const cellTexels of [0, 1.5]) assert.throws(() => readCloudPoints(fields({ cellTexels }), 'cloud.bin'), /cellTexels is a texel count/u);
  assert.throws(() => readCloudPoints(columns({ position: Float64Array.from([.1, Number.NaN, .3, 0, 0, 0]) }), 'cloud.bin'), /cloud.bin: every billboard has a finite place/u);
  assert.throws(() => readCloudPoints(columns({ position: Float64Array.from([.1, Infinity, .3, 0, 0, 0]) }), 'cloud.bin'), /finite place/u);
  for (const width of [0, -1, Number.NaN, Infinity]) assert.throws(() => readCloudPoints(columns({ diameter: Float32Array.from([.05, width]) }), 'cloud.bin'), /cloud.bin: every billboard has a positive width/u, String(width));
  assert.throws(() => readCloudPoints(columns({ cell: new Uint16Array(2) }), 'cloud.bin'), /column cell must be u16 with 4 values/u);
  for (const occluder of [{}, [{ centreUnits: [0, 0], axesUnits: ellipsoid.axesUnits }], [{ centreUnits: [0, 0, 0], axesUnits: ellipsoid.axesUnits.slice(0, 2) }],
    [{ centreUnits: [0, 0, 0], axesUnits: [[1, 0, 0], [0, 1, 0], [0, 0, Number.NaN]] }], [null],
    // a zero axis, and three axes in one plane: no inside to dim behind
    [{ centreUnits: [0, 0, 0], axesUnits: [[1, 0, 0], [0, 1, 0], [0, 0, 0]] }], [{ centreUnits: [0, 0, 0], axesUnits: [[1, 0, 0], [0, 1, 0], [1, 1, 0]] }]])
    assert.throws(() => readCloudPoints(fields({ occluder }), 'cloud.bin'), /cloud.bin: occluder is a list of ellipsoids, each a centre and three axes that span space/u, JSON.stringify(occluder));
  assert.throws(() => readCloudPoints(fields({ frame: { ...frame, metersPerUnit: 0 } }), 'cloud.bin'), /metres per unit must be positive/u);
  assert.equal(readCloudPoints(fields({ occluder: [{ centreUnits: [0, 0, 0], axesUnits: [[0, 1, 1], [1, 0, 1], [1, 1, 0]] }] }), 'cloud.bin').occluder.length, 1, 'oblique axes that span space are an ellipsoid');
  assert.equal(readCloudPoints(fields({ occluder: [] }), 'cloud.bin').occluder.length, 0, 'a cloud with no body hides nothing');
});
