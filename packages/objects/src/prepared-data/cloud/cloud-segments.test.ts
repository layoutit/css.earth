import { test } from 'node:test';
import assert from 'node:assert/strict';
import { decodePreparedBank, encodePreparedBank, type PreparedBank } from '../../prepared-bank.js';
import { encodeCloudSegments, readCloudSegments, type PreparedCloudSegments } from './cloud-segments.js';

const frame = { referenceFrame: 'icrf', epochJdTt: 1, originM: [0, 0, 0], localToReferenceXyzw: [0, 0, 0, 1],
  metersPerUnit: 100, boundsUnits: { min: [-1, -1, -1], max: [1, 1, 1] } } as const;
const ellipsoid = { centreUnits: [0, 0, 0], axesUnits: [[.5, 0, 0], [0, .25, 0], [0, 0, .25]] } as const;
const lines = (label?: PreparedCloudSegments['label']): PreparedCloudSegments => ({ id: 'proper-motions', frame: frame as never, count: 2,
  from: Float64Array.from([.1, -.2, .3, 0, 0, 0]), to: Float64Array.from([.2, -.1, .4, -.5, .5, .25]),
  rgba: Uint8Array.from([255, 128, 0, 200, 10, 20, 30, 255]), heads: Uint8Array.from([1, 0]), widthPixels: 1.5, occluder: [ellipsoid],
  ...(label ? { label } : {}) });
const travel = (bank: PreparedBank) => {
  const { bytes } = encodePreparedBank(bank, 'lines.bin');
  return decodePreparedBank(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer, 'lines.bin');
};
const plain = (l: PreparedCloudSegments) => ({ ...l, from: [...l.from], to: [...l.to], rgba: [...l.rgba], heads: [...l.heads] });

test('cloud segments travel through a bank file and read back to every line, its color, its head and its label', () => {
  assert.deepEqual(plain(readCloudSegments(travel(encodeCloudSegments(lines())), 'lines.bin')), plain(lines()));
  const labelled = lines({ text: 'Smith 2006 model', atUnits: [0, .5, 0] });
  const read = readCloudSegments(travel(encodeCloudSegments(labelled)), 'lines.bin');
  assert.deepEqual(plain(read), plain(labelled));
  assert.equal('label' in readCloudSegments(travel(encodeCloudSegments(lines())), 'lines.bin'), false, 'a bank without a label reads without one');
});

test('a bank that is not cloud segments, or whose lines, width, heads, occluder or label are malformed, is refused by name', () => {
  const bank = encodeCloudSegments(lines());
  const fields = (patch: Record<string, unknown>) => ({ ...bank, fields: { ...bank.fields, ...patch } });
  const columns = (patch: Record<string, unknown>) => ({ ...bank, columns: { ...bank.columns, ...patch } }) as PreparedBank;
  assert.throws(() => readCloudSegments({ ...bank, schema: 'cssearth-cloud-points@1' }, 'lines.bin'), /lines.bin: expected cssearth-cloud-segments@1/u);
  for (const id of ['Proper', '-x', 7]) assert.throws(() => readCloudSegments(fields({ id }), 'lines.bin'), /lines.bin: its id is a bank id/u, String(id));
  assert.throws(() => readCloudSegments(fields({ count: 1.5 }), 'lines.bin'), /count is a count/u);
  for (const widthPixels of [0, -1, Number.NaN, Infinity, '1']) assert.throws(() => readCloudSegments(fields({ widthPixels }), 'lines.bin'), /lines.bin: widthPixels is a positive width/u, String(widthPixels));
  assert.throws(() => readCloudSegments(columns({ from: Float64Array.from([.1, Number.NaN, .3, 0, 0, 0]) }), 'lines.bin'), /lines.bin: every line has finite ends/u);
  assert.throws(() => readCloudSegments(columns({ to: Float64Array.from([.1, .2, .3, 0, 0, Infinity]) }), 'lines.bin'), /every line has finite ends/u);
  assert.throws(() => readCloudSegments(columns({ head: Uint8Array.from([0, 2]) }), 'lines.bin'), /lines.bin: head is 0 or 1/u);
  assert.throws(() => readCloudSegments(columns({ rgba: new Uint8Array(4) }), 'lines.bin'), /column rgba must be u8 with 8 values/u);
  for (const occluder of [null, [{ centreUnits: [0, 0, 0], axesUnits: [[1, 0, 0], [0, 1, 0]] }], [{ centreUnits: [0, 0, 'x'], axesUnits: ellipsoid.axesUnits }],
    [{ centreUnits: [0, 0, 0], axesUnits: [[1, 0, 0], [0, 0, 0], [0, 0, 1]] }], [{ centreUnits: [0, 0, 0], axesUnits: [[1, 0, 0], [2, 0, 0], [0, 0, 1]] }]])
    assert.throws(() => readCloudSegments(fields({ occluder }), 'lines.bin'), /lines.bin: occluder is a list of ellipsoids, each a centre and three axes that span space/u, JSON.stringify(occluder));
  for (const label of [null, 'a model', { text: '', atUnits: [0, 0, 0] }, { text: 'model', atUnits: [0, 0] }, { text: 'model', atUnits: [0, 0, Number.NaN] }, { atUnits: [0, 0, 0] }])
    assert.throws(() => readCloudSegments(fields({ label }), 'lines.bin'), /lines.bin: label is a text and a place/u, JSON.stringify(label));
});
