import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { catalogueCells, cataloguePointSpread, catalogueBankColumns, decodeCatalogueBankBinary, decodePreparedBank, encodeCatalogueBankBinary, parseCataloguePoints } from '@cssearth/objects';
import { unpackPreparedBinary } from '@cssearth/objects/node';
import { cataloguePointColumnBuffers, cataloguePointColumns, readCataloguePointColumns } from './catalogue-point-columns.js';

const frame = { referenceFrame: 'sun-icrf', epochJdTt: 2451545, originM: [0, 0, 0], localToReferenceXyzw: [0, 0, 0, 1],
  metersPerUnit: 1, boundsUnits: { min: [-20, -20, -20], max: [20, 20, 20] } };
// Two levels of a stacked bank with a palette that sizes its dots: everything a published bank can carry.
const points = [[1, 0, -10, 0], [-1, 0.5, -10, 1], [3, 4, -12, 1], [0.0001, 0, 5, 0], [2, 2, 2, 2]], levels = [3, 2];
const bank = { schema: 'cssearth-catalogue-points@1', id: 'test-dots', frame,
  appearance: { colorCss: '#ffe2a8', radiusPx: .75, opacity: .7, palette: ['#8ec9ff', '#ffc07080', '#ffffff'], paletteRadiusPx: [1.1, .5, .9], screenBudget: 400,
    levels: [{ points: 3, fullDetailUnits: 100 }, { points: 2, appearUnits: [50, 10] }] },
  points, spread: cataloguePointSpread(points), cells: catalogueCells(points, levels) };
const file = () => { const { bytes } = encodeCatalogueBankBinary(bank, 'test.bin'); return decodePreparedBank(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer, 'test.bin'); };

test('a bank read as columns is the bank its JSON form parses to: every place, style and cell, with no object for a point', () => {
  const columns = readCataloguePointColumns(file(), 'test.bin'), parsed = parseCataloguePoints(bank);
  assert.equal(columns.count, parsed.points.length);
  assert.deepEqual([...columns.positions], parsed.points.flatMap(point => [...point.positionUnits]));
  assert.deepEqual(parsed.points.map((_, index) => columns.styles[columns.styleOf![index]!]), parsed.points.map(({ colorCss, radiusPx }) => ({ colorCss, radiusPx })));
  assert.deepEqual([...columns.cells.of], [...parsed.cells.of]);
  assert.deepEqual([...columns.cells.boxes], [...parsed.cells.boxes]);
  assert.deepEqual(columns.appearance, parsed.appearance); assert.deepEqual(columns.spread, parsed.spread); assert.deepEqual(columns.frame, parsed.frame);
  assert.equal(columns.reachUnits, Math.hypot(3, 4, -12));
  // The JSON form as columns names the same paint for every point, whatever its style table's order.
  const converted = cataloguePointColumns(parsed);
  assert.deepEqual([...converted.positions], [...columns.positions]);
  assert.deepEqual(parsed.points.map((_, index) => converted.styles[converted.styleOf![index]!]), parsed.points.map((_, index) => columns.styles[columns.styleOf![index]!]));
  assert.equal(converted.reachUnits, columns.reachUnits);
  // The reader hands over the file's buffer and the one the places were computed into.
  assert.equal(cataloguePointColumnBuffers(columns).length, 2);
});

test('columns are checked as the JSON form is: a palette index, a cell, a box and a level out of place are refused by name', () => {
  const altered = (change: (columns: ReturnType<typeof catalogueBankColumns>['columns']) => void, fields: object = {}) => {
    const source = catalogueBankColumns(bank, 'test.bin');
    change(source.columns);
    return { ...source, fields: { ...source.fields, ...fields } };
  };
  assert.throws(() => readCataloguePointColumns(altered(columns => { columns.palette![4] = 3; }), 'test.bin'), /test-dots \(test.bin\): point 4 names palette color 3, which the palette of 3 lacks/u);
  assert.throws(() => readCataloguePointColumns(altered(columns => { columns.x![0] = 990_000; }), 'test.bin'), /test-dots \(test.bin\): catalogue point bank field cells box \d+ does not hold point 0 \(99, 0, -10\)/u);
  assert.throws(() => readCataloguePointColumns(altered(columns => { columns.cell![4] = columns.cell![0]!; }), 'test.bin'), /cells (cell \d+ spans levels 0 and 1|box \d+ does not hold point 4)/u);
  assert.throws(() => readCataloguePointColumns(altered(columns => { columns.boxes![0] = 1e9; }), 'test.bin'), /cells box 0 must be six finite bounds, each minimum at most its maximum/u);
  assert.throws(() => readCataloguePointColumns(altered(() => {}, { appearance: { ...bank.appearance, palette: undefined, paletteRadiusPx: undefined } }), 'test.bin'), /has a palette column and no palette/u);
  assert.throws(() => readCataloguePointColumns({ ...altered(() => {}), schema: 'cssearth-catalogue-points-bin@1' }, 'test.bin'), /test.bin: not a catalogue point bank \(expected cssearth-catalogue-points-bin@2, got cssearth-catalogue-points-bin@1\)/u);
});

test('a published bank reads as columns to what its JSON form parses to', t => {
  // The nearby galaxies' bank, where this checkout has restored it: 39,916 points in five levels.
  const path = new URL('../../../../src/objects/nearby-universe-galaxies/prepared/dots.bin', import.meta.url);
  let bytes: Buffer;
  try { bytes = readFileSync(path); } catch { t.skip('src/objects/nearby-universe-galaxies/prepared/dots.bin is not restored here'); return; }
  const columns = readCataloguePointColumns(decodePreparedBank(unpackPreparedBinary(bytes, path.pathname), path.pathname), path.pathname);
  const parsed = parseCataloguePoints(decodeCatalogueBankBinary(unpackPreparedBinary(bytes, path.pathname), path.pathname));
  assert.ok(columns.count > 30_000);
  assert.equal(columns.count, parsed.points.length);
  for (let index = 0; index < columns.count; index++) {
    const point = parsed.points[index]!, style = columns.styles[columns.styleOf ? columns.styleOf[index]! : 0]!;
    if (columns.positions[index * 3] !== point.positionUnits[0] || columns.positions[index * 3 + 1] !== point.positionUnits[1] || columns.positions[index * 3 + 2] !== point.positionUnits[2] ||
        style.colorCss !== point.colorCss || style.radiusPx !== point.radiusPx || columns.cells.of[index] !== parsed.cells.of[index]) assert.fail(`point ${index} differs between the two readings`);
  }
});
