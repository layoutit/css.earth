import assert from 'node:assert/strict';
import { sourceTest } from '../../../tests/objects/source-test.mts';
const test = sourceTest();
import { parsePdsRadialTable } from './pds-radial-table.mts';

const profile = { latitudeStepDegrees: 90, longitudeStepDegrees: 90,
  metersPerUnit: 1000, longitudeDirection: 'east', expectedRecords: 15 };
const records = [90, 0, -90].flatMap(latitude => [0, 90, 180, 270, 360].map(longitude =>
  [latitude, longitude, latitude === 90 ? 1 : latitude === -90 ? 2 : 3 + Math.sin(longitude * Math.PI / 180)]));
// Explicit seam values keep this independent fixture free of sin(2pi) noise.
records[9][2] = records[5][2];
const text = records.map(row => row.join(' ')).join('\n');

test('radial table respects angular coordinates, source units, pole and seam', () => {
  const east = parsePdsRadialTable(text, profile);
  assert.equal(east.sample(90, 0), 4000);
  assert.equal(east.sample(-90, 0), 2000);
  assert.equal(east.sample(45, 45), 2250);
  assert.equal(east.sample(360, 0), east.sample(0, 0));
  assert.equal(east.sample(210, -90), 2000);
  assert.equal(east.sample(0, 91), null);
  const west = parsePdsRadialTable(text, { ...profile, longitudeDirection: 'west' });
  assert.equal(west.sample(90, 0), 2000);
  const reordered = parsePdsRadialTable(records.map(([lat, lon, r]) => `${lon} ${lat} ${r}`).reverse().join('\n'),
    { ...profile, columns: ['longitude', 'latitude', 'radius'] });
  assert.equal(reordered.sample(90, 0), 4000);
});

test('radial source gaps remain missing and malformed grids fail rather than being filled', () => {
  const masked = parsePdsRadialTable(text, { ...profile, noDataRadius: 4 });
  assert.equal(masked.sample(45, 0), null);
  assert.equal(masked.sample(225, 0), 2500);
  assert.throws(() => parsePdsRadialTable(text.replace('90 90 1', '90 90 2'), profile), /pole/);
  assert.throws(() => parsePdsRadialTable(text.replace('0 360 3', '0 360 4'), profile), /seam/);
  assert.throws(() => parsePdsRadialTable(text.replace('0 90 4', '0 0 4'), profile), /duplicate/);
  assert.throws(() => parsePdsRadialTable(text.split('\n').slice(1).join('\n'), profile), /count/);
});
