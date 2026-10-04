import { test } from 'node:test';
import assert from 'node:assert/strict';
import { decodePreparedBank, encodePreparedBank, preparedBankColumn } from './prepared-bank.js';
import { packPreparedBank, unpackPreparedBank } from './node/prepared-binary-file.js';

test('a bank keeps its fields and every column, each a view over the one buffer, through encoding and packing', () => {
  const bank = { schema: 'cssearth-test@1', fields: { id: 'dots', palette: ['#ffffff'], nested: { reach: 2.5 } },
    columns: { x: Int32Array.from([1, -2, 3]), cell: Uint16Array.from([0, 1, 1]), boxes: Float64Array.from([0.5, 1.5]), none: new Uint8Array(0) } };
  const { bytes, regions } = encodePreparedBank(bank, 'dots.bin');
  assert.deepEqual(regions.map(region => region.elementBytes), [4, 2, 8]);
  assert.ok(regions.every(region => region.offset % 8 === 0));
  for (const decoded of [decodePreparedBank(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer, 'dots.bin'), unpackPreparedBank(packPreparedBank(bank, 'dots.bin'), 'dots.bin')]) {
    assert.equal(decoded.schema, bank.schema);
    assert.deepEqual(decoded.fields, bank.fields);
    assert.deepEqual(Object.keys(decoded.columns), ['x', 'cell', 'boxes', 'none']);
    assert.deepEqual([...preparedBankColumn(decoded, 'x', 'i32', 3)], [1, -2, 3]);
    assert.deepEqual([...preparedBankColumn(decoded, 'cell', ['u16', 'u32'])], [0, 1, 1]);
    assert.deepEqual([...preparedBankColumn(decoded, 'boxes', 'f64')], [0.5, 1.5]);
    assert.equal(new Set(Object.values(decoded.columns).map(column => column.buffer)).size, 1, 'one buffer to transfer');
    assert.throws(() => preparedBankColumn(decoded, 'x', 'f64', undefined, 'dots.bin'), /dots.bin: column x must be f64, got Int32Array with 3/u);
    assert.throws(() => preparedBankColumn(decoded, 'x', 'i32', 4, 'dots.bin'), /with 4 values/u);
  }
});

test('a file that is not a bank, or whose columns leave its bytes, is refused by name', () => {
  assert.throws(() => decodePreparedBank(new ArrayBuffer(16), 'x.bin'), /x.bin: not a prepared bank \(expected magic CSBANK01\)/u);
  const { bytes } = encodePreparedBank({ schema: 's@1', fields: {}, columns: { x: Float64Array.from([1, 2]) } });
  assert.throws(() => decodePreparedBank(bytes.slice(0, bytes.byteLength - 8).buffer as ArrayBuffer, 'x.bin'), /x.bin: column x is \["f64",0,2\], which is not \[type, offset, length\] inside the file's \d+ bytes/u);
  assert.throws(() => encodePreparedBank({ schema: 's@1', fields: {}, columns: { x: new BigInt64Array(1) as never } }, 'x.bin'), /x.bin: column x must be one of f64/u);
});
