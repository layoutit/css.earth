// Draft checks for facet-fits-layout.ts: the production fixture cases must behave as before, and the
// Bennu products must decode with exactly the declared label/FITS disagreements.
// node --test output/bennu-even-more/drafts/facet-fits-layout.test.mts
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync, existsSync} from 'node:fs';
import {resolve} from 'node:path';
import {parseObjShape, loadObjShape} from '@cssearth/bake/objects/geometry';
import {parseFacetFits} from '@cssearth/bake/objects/raster';

const header = (values: Record<string, string | number | boolean | undefined>) => {
  const cards = Object.entries(values).map(([key, value]) => (key.padEnd(8) + '= ' +
    (typeof value === 'boolean' ? value ? 'T' : 'F' : typeof value === 'string' ? "'" + value + "'" : String(value))).padEnd(80));
  cards.push('END'.padEnd(80));
  return Buffer.from(cards.join('').padEnd(Math.ceil(cards.length * 80 / 2880) * 2880, ' '), 'ascii');
};
// Same fixture as tests/objects/terrestrial/facet-scalars.test.mts, with an optional short TFORM.
function fitsFixture(reverseSource = false, shortForm = false) {
  const source = parseObjShape('v 3 0 0\nv 0 3 0\nv 0 0 3\nv 7 0 0\nv 4 3 0\nv 4 0 3\n' + (reverseSource ? 'f 4 5 6\nf 1 2 3' : 'f 1 2 3\nf 4 5 6'),
    {metersPerUnit: 1000, expectedVertices: 6, expectedFaces: 2});
  const names = ['FACET_NUM', 'LATITUDE', 'LONGITUDE', 'RADIUS', 'SLOPE', 'SIGMA'];
  const units = [undefined, 'DEGREES', 'DEGREES', 'KILOMETERS', 'DEGREES', 'DEGREES'];
  const primary = header({SIMPLE: true, BITPIX: 8, NAXIS: 0, TARGET: 'FIXTURE', OBJ_FILE: 'fixture.obj', PRODNAME: 'fixture.fits'});
  const columns: Record<string, string | number | boolean | undefined> = {XTENSION: 'BINTABLE', BITPIX: 8, NAXIS: 2, NAXIS1: 24, NAXIS2: 2, PCOUNT: 0, GCOUNT: 1, TFIELDS: 6};
  names.forEach((name, i) => { columns['TTYPE' + (i + 1)] = name; columns['TFORM' + (i + 1)] = (shortForm ? '' : '1') + (i ? 'E' : 'J'); if (units[i]) columns['TUNIT' + (i + 1)] = units[i]; });
  const data = Buffer.alloc(2880); data.writeInt32BE(0);
  [Math.asin(1 / Math.sqrt(3)) * 180 / Math.PI, 45, Math.sqrt(3), 0, 0].forEach((n, i) => data.writeFloatBE(n, (i + 1) * 4));
  data.writeInt32BE(1, 24);
  [Math.asin(1 / Math.sqrt(27)) * 180 / Math.PI, Math.atan2(1, 5) * 180 / Math.PI, Math.sqrt(27), 30, 2].forEach((n, i) => data.writeFloatBE(n, 24 + (i + 1) * 4));
  const bytes = Buffer.concat([primary, header(columns), data]);
  const xml = '<file_name>fixture.fits</file_name><comment>fixture.obj</comment><records>2</records><record_length unit="byte">24</record_length>' +
    names.map((name, i) => '<Field_Binary><name>' + name + '</name><field_location unit="byte">' + (i * 4 + 1) +
      '</field_location><field_length unit="byte">4</field_length><data_type>' + (i ? 'IEEE754MSBSingle' : 'SignedMSB4') + '</data_type></Field_Binary>').join('');
  return {source, bytes, xml, profile: {expectedRows: 2, target: 'FIXTURE', meshFile: 'fixture.obj', field: 'SLOPE', units: 'DEGREES', maximumCentroidErrorMeters: .001}};
}

test('production fixture cases are unchanged', () => {
  const f = fitsFixture(), table = parseFacetFits(f.bytes, f.xml, f.profile, f.source);
  assert.equal(table.values[0], 0); assert.equal(table.sigmas[0], 0); assert.equal(table.report.zeroSigmaRows, 1);
  const reordered = Buffer.from(f.bytes); reordered.writeInt32BE(1, 5760);
  assert.throws(() => parseFacetFits(reordered, f.xml, f.profile, f.source), /IDs changed/);
  assert.throws(() => parseFacetFits(f.bytes, f.xml.replace('<name>SLOPE', '<name>ALBEDO'), f.profile, f.source), /label differs/);
  assert.throws(() => parseFacetFits(f.bytes, f.xml, {...f.profile, meshFile: 'other.obj'}, f.source), /identity/);
  const r = fitsFixture(true);
  assert.throws(() => parseFacetFits(r.bytes, r.xml, r.profile, r.source), /does not match source geometry/);
  const bijected = parseFacetFits(r.bytes, r.xml, {...r.profile, registration: 'centroid-bijection'}, r.source);
  assert.deepEqual([...bijected.values], [30, 0]); assert.deepEqual([...bijected.sourceRows], [1, 0]); assert.equal(bijected.report.remappedRows, 2);
});

test('short TFORM is the same column; declared disagreements are required, not inferred', () => {
  const f = fitsFixture(false, true);
  assert.deepEqual([...parseFacetFits(f.bytes, f.xml, f.profile, f.source).values], [0, 30]);
  assert.throws(() => parseFacetFits(f.bytes, f.xml.replace('<records>2', '<records>9'), f.profile, f.source), /label differs/);
  assert.equal(parseFacetFits(f.bytes, f.xml.replace('<records>2', '<records>9'), {...f.profile, labelRecords: 9}, f.source).report.validRows, 2);
  assert.throws(() => parseFacetFits(f.bytes, f.xml.replace('<name>SLOPE', '<name>TILT'), f.profile, f.source), /label differs/);
  assert.equal(parseFacetFits(f.bytes, f.xml.replace('<name>SLOPE', '<name>TILT'), {...f.profile, labelNames: {SLOPE: 'TILT'}}, f.source).report.validRows, 2);
  const missing = parseFacetFits(f.bytes, f.xml, {...f.profile, missingValue: 30}, f.source);
  assert.equal(missing.report.missingValueRows, 1); assert.ok(Number.isNaN(missing.values[1]));
});

const root = resolve(import.meta.dirname, '../../../src/objects/bennu/source');
const recipe = JSON.parse(readFileSync(resolve(root, 'preparation/terrestrial.json'), 'utf8'));
const alternatives: {lensId: string; additionalLensIds?: string[]; path: string; grid: {metersPerUnit: number; expectedVertices: number; expectedFaces: number}}[] = recipe.geometry.radialTerrainAlternatives ?? [];
for (const lens of (recipe.raster.scientific as {id: string; format: string; path: string; meshPath: string; table: {labelPath: string}}[]).filter(l => l.format === 'facet-scalars')) {
  test('Bennu ' + lens.id + ' decodes on its own archived mesh', {skip: !existsSync(resolve(root, lens.path))}, async () => {
    const terrain = alternatives.find(a => [a.lensId, ...(a.additionalLensIds ?? [])].includes(lens.id));
    assert.ok(terrain && terrain.path === lens.meshPath, 'lens mesh is its alternative terrain');
    const mesh = await loadObjShape(resolve(root, terrain.path), terrain.grid);
    const table = parseFacetFits(readFileSync(resolve(root, lens.path)), readFileSync(resolve(root, lens.table.labelPath), 'utf8'), lens.table, mesh);
    console.log(lens.id, JSON.stringify(table.report));
    assert.ok(table.report.validRows > 0.99 * table.report.rows);
    assert.ok(table.report.maximumCentroidErrorMeters < 0.001);
  });
}
