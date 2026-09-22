import assert from 'node:assert/strict';
import { sourceTest } from '../../tests/objects/source-test.mts';
const test = sourceTest();
import { readDaf } from './daf.mts';
import { ckSegments, quaternionToMatrix, apply, multiply, transpose } from './ck.mts';

function ck(type: number, data: number[], { start = 0, stop = 100, instrument = -999000, reference = 1, rates = 1 } = {}) {
  const records = 3 + Math.ceil(data.length / 128), out = new Uint8Array(records * 1024), view = new DataView(out.buffer);
  const write = (offset: number, text: string) => { for (let i = 0; i < text.length; i++) out[offset + i] = text.charCodeAt(i); };
  write(0, 'DAF/CK  '); view.setInt32(8, 2, true); view.setInt32(12, 6, true); write(16, 'test'.padEnd(60)); view.setInt32(76, 2, true); view.setInt32(80, 2, true); write(88, 'LTL-IEEE');
  const base = 1024; view.setFloat64(base + 16, 1, true); view.setFloat64(base + 24, start, true); view.setFloat64(base + 32, stop, true);
  const first = 3 * 128 + 1;
  [instrument, reference, type, rates, first, first + data.length - 1].forEach((value, i) => view.setInt32(base + 40 + i * 4, value, true));
  write(2048, 'segment'.padEnd(40));
  data.forEach((value, i) => view.setFloat64((first - 1 + i) * 8, value, true));
  return ckSegments(readDaf(out))[0];
}
const zRotation = (degrees: number) => { const h = degrees * Math.PI / 360; return [Math.cos(h), 0, 0, Math.sin(h)]; };

test('NAIF q2m turns a scalar-first quaternion into the matrix that rotates +X toward +Y for a positive Z angle', () => {
  // q2m of a 90° rotation about +Z maps +X to +Y (the active rotation); as a CK C-matrix this is the reference-to-instrument map.
  const c = quaternionToMatrix(zRotation(90));
  const v = apply(c, [1, 0, 0]);
  assert.ok(Math.abs(v[0]) < 1e-12 && Math.abs(v[1] - 1) < 1e-12 && Math.abs(v[2]) < 1e-12, JSON.stringify(v));
  const identity = multiply(c, transpose(c));
  for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) assert.ok(Math.abs(identity[i][j] - (i === j ? 1 : 0)) < 1e-12);
});

test('type 3 segments interpolate between records inside an interval and refuse gaps', () => {
  // Records at ticks 0, 10, 20 rotating 0°, 30°, 60° about Z; one interval covering all; rates present.
  const q = [zRotation(0), zRotation(30), zRotation(60)];
  const data = [...q.flatMap(v => [...v, 0, 0, 1]), 0, 10, 20, 0, 1, 3];
  const segment = ck(3, data);
  const at = (sclk: number, tolerance?: number) => segment.pointing(sclk, tolerance);
  const half = at(5); assert.ok(half);
  const expected = quaternionToMatrix(zRotation(15));
  for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) assert.ok(Math.abs(half.cMatrix[i][j] - expected[i][j]) < 1e-12, 'midpoint slerp');
  assert.deepEqual(half.angularVelocity, [0, 0, 1]);
  assert.ok(at(20)); assert.equal(at(25), null); assert.equal(at(-1), null);
  assert.ok(at(25, 6), 'tolerance reaches the last record');
});

test('type 1 discrete records need an exact or tolerated time; type 2 propagates a constant rate', () => {
  const one = ck(1, [...zRotation(45), 0, 0, 0, 7, 1], { rates: 1 }); // record, time tag, record count (no directory epoch below 101 records)
  assert.equal(one.pointing(6), null); assert.ok(one.pointing(7)); assert.ok(one.pointing(9, 2));
  const rate = Math.PI / 180; // one degree per second about Z
  const two = ck(2, [...zRotation(0), 0, 0, rate, 1, 0, 100], { rates: 1 }); // record, start, stop: SPICE derives the count from the length
  const turned = two.pointing(30); assert.ok(turned);
  const expected = quaternionToMatrix(zRotation(30));
  for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) assert.ok(Math.abs(turned.cMatrix[i][j] - expected[i][j]) < 1e-9, `type 2 propagation ${i}${j}`);
  assert.throws(() => ck(4, [0, 0, 0, 0, 0, 1]), /Unsupported CK segment type 4/);
});
