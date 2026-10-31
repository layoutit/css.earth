import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readNpy, writeNpy, type NpyArray } from './npy.mts';

// The bytes np.save (NumPy 2.5.4) writes for each array, and the array.
const FIXTURES: [string, NpyArray][] = [
  ['k05VTVBZAQB2AHsnZGVzY3InOiAnPGY4JywgJ2ZvcnRyYW5fb3JkZXInOiBGYWxzZSwgJ3NoYXBlJzogKDIsIDMpLCB9ICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIAoAAAAAAAD4PwAAAAAAAALAAAAAAAAACEAAAAAAAAAQQAAAAAAAABRAg7Y60pcS0AE=',
    { dtype: '<f8', shape: [2, 3], data: Float64Array.of(1.5, -2.25, 3, 4, 5, 6e-300) }],
  ['k05VTVBZAQB2AHsnZGVzY3InOiAnPGY0JywgJ2ZvcnRyYW5fb3JkZXInOiBGYWxzZSwgJ3NoYXBlJzogKDIsKSwgfSAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIArNzMw9AAAgQA==',
    { dtype: '<f4', shape: [2], data: Float32Array.of(0.1, 2.5) }],
  ['k05VTVBZAQB2AHsnZGVzY3InOiAnPGk4JywgJ2ZvcnRyYW5fb3JkZXInOiBGYWxzZSwgJ3NoYXBlJzogKDIsKSwgfSAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIAr9/////////wAAAAAAAQAA',
    { dtype: '<i8', shape: [2], data: BigInt64Array.of(-3n, 2n ** 40n) }],
  ['k05VTVBZAQB2AHsnZGVzY3InOiAnfGIxJywgJ2ZvcnRyYW5fb3JkZXInOiBGYWxzZSwgJ3NoYXBlJzogKDEsIDIpLCB9ICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIAoBAA==',
    { dtype: '|b1', shape: [1, 2], data: Uint8Array.of(1, 0) }],
  ['k05VTVBZAQB2AHsnZGVzY3InOiAnfHUxJywgJ2ZvcnRyYW5fb3JkZXInOiBGYWxzZSwgJ3NoYXBlJzogKDIsKSwgfSAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIAoH/w==',
    { dtype: '|u1', shape: [2], data: Uint8Array.of(7, 255) }],
  ['k05VTVBZAQB2AHsnZGVzY3InOiAnPGY4JywgJ2ZvcnRyYW5fb3JkZXInOiBGYWxzZSwgJ3NoYXBlJzogKDAsIDMpLCB9ICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIAo=',
    { dtype: '<f8', shape: [0, 3], data: new Float64Array(0) }],
  ['k05VTVBZAQB2AHsnZGVzY3InOiAnPGY4JywgJ2ZvcnRyYW5fb3JkZXInOiBGYWxzZSwgJ3NoYXBlJzogKCksIH0gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIAoAAAAAAAAEQA==',
    { dtype: '<f8', shape: [], data: Float64Array.of(2.5) }],
  // A header the room to grow the first axis pushes past 128 bytes.
  ['k05VTVBZAQC2AHsnZGVzY3InOiAnfHUxJywgJ2ZvcnRyYW5fb3JkZXInOiBGYWxzZSwgJ3NoYXBlJzogKDEsIDEsIDEsIDEsIDEsIDEsIDEsIDEsIDEsIDEsIDEsIDEsIDEsIDEsIDIpLCB9ICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAKAAA=',
    { dtype: '|u1', shape: [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 2], data: Uint8Array.of(0, 0) }],
];

test('reads what np.save wrote, and writes the same bytes', () => {
  for (const [base64, array] of FIXTURES) {
    const bytes = new Uint8Array(Buffer.from(base64, 'base64'));
    assert.deepEqual(readNpy(bytes), array);
    assert.deepEqual(Buffer.from(writeNpy(array)).toString('base64'), base64);
  }
});

test('a large array round-trips', () => {
  const data = Float32Array.from({ length: 100000 }, (_, i) => Math.sin(i) * 1e3), back = readNpy(writeNpy({ dtype: '<f4', shape: [100, 1000], data }));
  assert.deepEqual(back, { dtype: '<f4', shape: [100, 1000], data });
});

test('malformed files and arrays are refused', () => {
  const good = new Uint8Array(Buffer.from(FIXTURES[0]![0], 'base64'));
  assert.throws(() => readNpy(good.slice(0, good.length - 1)), TypeError);
  assert.throws(() => readNpy(Uint8Array.of(1, 2, 3)), TypeError);
  const bigEndian = good.slice(); bigEndian.set(new TextEncoder().encode('>'), 21);
  assert.throws(() => readNpy(bigEndian), TypeError);
  const fortran = new Uint8Array(Buffer.from(Buffer.from(good).toString('latin1').replace("'fortran_order': False", "'fortran_order': True "), 'latin1'));
  assert.throws(() => readNpy(fortran), /Fortran/u);
  assert.throws(() => writeNpy({ dtype: '<f8', shape: [3], data: new Float64Array(2) }), RangeError);
  assert.throws(() => writeNpy({ dtype: '|b1', shape: [1], data: Uint8Array.of(2) }), RangeError);
});
