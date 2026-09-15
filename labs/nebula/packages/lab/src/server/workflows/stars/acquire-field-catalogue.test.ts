import assert from 'node:assert/strict';
import test from 'node:test';
import { mergeFieldCatalogue, readFieldCatalogueTsv } from './acquire-field-catalogue.ts';
const hipColumns = ['HIP', 'RAICRS', 'DEICRS', 'Vmag', 'B-V', 'e_B-V', 'Plx', 'e_Plx', 'pmRA', 'pmDE', 'e_pmRA', 'e_pmDE'];
const tychoColumns = ['TYC1', 'TYC2', 'TYC3', 'RAmdeg', 'DEmdeg', 'pmRA', 'pmDE', 'e_pmRA', 'e_pmDE', 'BTmag', 'e_BTmag', 'VTmag', 'e_VTmag', 'HIP'];
function source(table: string, columns: string[], rows: (string | number)[][]) {
  return `#Name: ${table}\n${columns.join('\t')}\n${columns.map(() => 'unit').join('\t')}\n${columns.map(() => '----').join('\t')}\n${rows.map(row => row.join('\t')).join('\n')}\n`;
}
const hip = source('I/239/hip_main', hipColumns, [[17702, 56.87110065, 24.10524193, 2.85, -.086, .012, 8.87, .99, 19.35, -43.11, .82, .59]]);
const tycho = source('I/259/tyc2', tychoColumns, [
  [1800, 2202, 1, '', '', '', '', '', '', 2.770, .014, 2.834, .009, 17702],
  [1, 2, 1, 56, 24, 2, 3, .1, .1, 9, .1, 8, .2, ''],
]);
test('measured bright HIP survives missing Tycho astrometry, wins identity, and keeps blue-white measured color', () => {
  const result = mergeFieldCatalogue(hip, tycho); assert.equal(result.stars.length, 2);
  const star = result.stars[0]!; assert.equal(star.id, 'HIP 17702'); assert.equal(star.magnitudeV, 2.85);
  assert.equal(star.colorIndexBV, -.086); assert.deepEqual(star.tycho, ['1800-2202-1']);
  assert.equal(star.sourceEpochJulianYear, 1991.25); assert.ok(star.raDegrees > star.sourceRaDegrees);
  assert.ok(star.decDegrees < star.sourceDecDegrees); assert.equal(star.photometry.errorMagnitudeV, null);
  assert.equal(result.stars[1]!.magnitudeV, 7.91); assert.equal(result.stars[1]!.colorIndexBV, .85);
});
test('scientific pin survives changed response timestamp but rejects changed photometry', () => {
  const pin = readFieldCatalogueTsv(hip, 'hipparcos').dataSha256;
  assert.equal(readFieldCatalogueTsv('#INFO\tDate=new\n' + hip, 'hipparcos').dataSha256, pin);
  assert.notEqual(readFieldCatalogueTsv(hip.replace('2.85', '3.85'), 'hipparcos').dataSha256, pin);
});
test('error responses, missing columns, invalid numbers and duplicate HIP IDs fail', () => {
  assert.throws(() => readFieldCatalogueTsv('<html>Unavailable</html>', 'hipparcos'));
  assert.throws(() => readFieldCatalogueTsv(hip.replace('Vmag', 'wrong'), 'hipparcos'));
  assert.throws(() => readFieldCatalogueTsv(hip.replace('2.85', 'NaN'), 'hipparcos'));
  assert.throws(() => mergeFieldCatalogue(hip + hip.split('\n').at(-2)! + '\n', tycho));
});
