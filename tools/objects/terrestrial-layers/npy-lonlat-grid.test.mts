import assert from 'node:assert/strict';
import { sourceTest } from '../../../tests/objects/source-test.mts';
const test = sourceTest();
import { decodeNpyLonLatGrid, readNpy, spinFrameTransfer } from './npy-lonlat-grid.mts';

/** A version 1.0 .npy file as NumPy writes it: magic, header padded with spaces to a 64-byte boundary, then the data. */
function npy(descr: '<f8' | '<i8', shape: readonly number[], values: readonly number[], fortran = false) {
  let header = `{'descr': '${descr}', 'fortran_order': ${fortran ? 'True' : 'False'}, 'shape': (${shape.join(', ')}${shape.length === 1 ? ',' : ''}), }`;
  header = header.padEnd(Math.ceil((header.length + 11) / 64) * 64 - 11) + '\n';
  const data = Buffer.alloc(values.length * 8);
  values.forEach((value, i) => descr === '<f8' ? data.writeDoubleLE(value, i * 8) : data.writeBigInt64LE(BigInt(value), i * 8));
  const prefix = Buffer.from([0x93, 0x4e, 0x55, 0x4d, 0x50, 0x59, 1, 0, 0, 0]);
  prefix.writeUInt16LE(header.length, 8);
  return Buffer.concat([prefix, Buffer.from(header, 'latin1'), data]);
}

const longitudes = readNpy(npy('<i8', [5], [-180, -90, 0, 90, 180]));
const latitudes = readNpy(npy('<i8', [3], [-90, 0, 90]));
// Row 0 is the southern node row; the values name their node so a lookup error is visible.
const values = readNpy(npy('<f8', [3, 5], [0, 1, 2, 3, 4, 10, 11, NaN, 13, 14, 20, 21, 22, 23, 24]));

test('int64 and float64 arrays keep their shape and values', () => {
  assert.deepEqual(longitudes.shape, [5]);
  assert.deepEqual([...longitudes.values], [-180, -90, 0, 90, 180]);
  assert.deepEqual(values.shape, [3, 5]);
  assert.ok(Number.isNaN(values.values[7]));
});

test('each direction takes its nearest node; the two half-cells at 180 degrees stay distinct', () => {
  const grid = decodeNpyLonLatGrid({ values, longitudes, latitudes }, null);
  assert.equal(grid.sample(0, 0), null, 'NaN nodes are missing');
  assert.equal(grid.sample(80, 10), 13);
  assert.equal(grid.sample(-100, -10), 11);
  assert.equal(grid.sample(-170, 0), 10, 'just east of -180 belongs to the -180 node');
  assert.equal(grid.sample(170, 0), 14, 'just west of 180 belongs to the 180 node');
  assert.equal(grid.sample(250, 0), 11, 'longitudes beyond 180 wrap');
  assert.equal(grid.sample(90, 60), 23);
  assert.equal(grid.sample(90, -60), 3);
});

test('a frame transfer between identical spin states is the identity; a phase offset shifts longitude', () => {
  const spin = { longitudeDegrees: 36, latitudeDegrees: -8, periodHours: 4.195948, epochJd: 2451545, phaseDegrees: 341.56 };
  const same = spinFrameTransfer(spin, 0, spin, 0, 2458653.83);
  same.meshToGrid.forEach((row, i) => row.forEach((value, j) => assert.ok(Math.abs(value - (i === j ? 1 : 0)) < 1e-12)));
  // The mesh's prime meridian sits 90 degrees east in a grid whose phase is 90 degrees behind.
  const turned = spinFrameTransfer(spin, 0, { ...spin, phaseDegrees: spin.phaseDegrees + 90 }, 0, 2458653.83);
  assert.ok(Math.abs(Number(turned.report.meshPrimeMeridianGridLongitudeDegrees) - 90) < 1e-9);
  const grid = decodeNpyLonLatGrid({ values, longitudes, latitudes }, turned.meshToGrid);
  assert.equal(grid.sample(0, 0), 13, 'mesh longitude 0 reads the grid node at 90 east');
});

test('unsupported arrays fail closed', () => {
  assert.throws(() => readNpy(npy('<f8', [2], [1, 2], true)), /C-order/);
  assert.throws(() => readNpy(Buffer.from('not an array')), /Not a NumPy/);
  const truncated = npy('<f8', [2], [1, 2]);
  assert.throws(() => readNpy(truncated.subarray(0, truncated.length - 8)), /shape does not match/);
  const uneven = readNpy(npy('<i8', [5], [-180, -90, 0, 45, 180]));
  assert.throws(() => decodeNpyLonLatGrid({ values, longitudes: uneven, latitudes }, null), /evenly spaced/);
});
