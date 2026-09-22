import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readOracleFixture, readOracleInput } from '../../oracles/fixture.mts';
import { requireArray, requireRecord, requireString } from '../../sources/source-values.mts';
import { binaryTable, findTable, numbers, readFitsHdus, tableColumn, text, writeCell } from './fits-table.mts';

const fixture = await readOracleFixture('fits/binary-table.json');
const input = fixture.inputs.find(entry => entry.path === 'tests/fixtures/fits/binary-table-columns.fits');
assert.ok(input);
const bytes = await readOracleInput(input), entry = requireRecord(fixture.cases['oi-test']);

test('Astropy binary-table cells: every column type, TNULL as NaN, HIERARCH keys', () => {
  const table = findTable(bytes, requireString(entry.extname)), cells = requireRecord(entry.cells);
  assert.equal(table.rows, entry.rows); assert.equal(table.rowBytes, entry.rowBytes);
  assert.deepEqual(table.columns.map(column => column.name), requireArray(entry.columns).map(column => requireRecord(column).name));
  assert.equal(table.hdu.header.INSNAME, entry.insname);
  assert.equal(table.hdu.header['ESO PRO CATG'], requireRecord(entry.hierarch)['ESO PRO CATG']);
  assert.equal(readFitsHdus(bytes)[1]!.headerOffset, 2880);
  for (const [name, expected] of Object.entries(cells)) {
    const column = tableColumn(table, name), rows = requireArray(expected);
    rows.forEach((row, index) => {
      if (column.type === 'A') { assert.equal(text(bytes, table, index, column), row, `${name} row ${index}`); return; }
      assert.deepEqual(numbers(bytes, table, index, column), requireArray(row).map(value => value === null ? Number.NaN : value), `${name} row ${index}`);
    });
  }
});

test('a column scaled by TSCAL or TZERO is refused, never returned or written unscaled', () => {
  const table = binaryTable(readFitsHdus(bytes)[1]!), scaled = tableColumn(table, requireString(requireArray(entry.scaled)[0]));
  assert.throws(() => numbers(bytes, table, 0, scaled), /TSCAL or TZERO/);
  assert.throws(() => writeCell(Buffer.from(bytes), table, 0, scaled, 0, 1), /TSCAL or TZERO/);
});
