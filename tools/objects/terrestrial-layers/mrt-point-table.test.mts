import assert from 'node:assert/strict';
import {test} from 'node:test';
import {createPointTableSampler, parsePointTable, pointClassIndex, validatePointTableProfile} from './mrt-point-table.mts';

const rule = '-'.repeat(80);
const table = (rows: string[], longitudeExplanation = 'Degrees West longitude') => [
  'Title: Example hot spots', 'Authors: Example', 'Table: Example', '='.repeat(80), 'Byte-by-byte Description of file: example.txt', rule,
  '   Bytes Format Units Label   Explanations', rule,
  '   1-  3 I3     ---   Rank    Rank by power ',
  '  38- 42 F5.1   deg   Lat     Degrees North latitude',
  `  44- 48 F5.1   deg   Long    ${longitudeExplanation}`,
  '  66- 72 F7.2   GW    Power   Hot spot thermal emission (4)', rule, 'Note (4): Example.', rule, ...rows].join('\n');
const row = (rank: number, lat: string, lon: string, power: string) =>
  `${String(rank).padStart(3)}${' '.repeat(34)}${lat.padStart(5)} ${lon.padStart(5)}${' '.repeat(17)}${power.padStart(7)} `;
const column = (label: string, bytes: number[], format: string, units: string, explanation: string) => ({label, bytes, format, units, explanation});
const lens = {format: 'mrt-point-table', path: 'example.txt', sampling: 'nearest',
  grid: {title: 'Example hot spots', expectedRows: 3, longitudeDirection: 'west-positive',
    rank: column('Rank', [1, 3], 'I3', '---', 'Rank by power'), latitude: column('Lat', [38, 42], 'F5.1', 'deg', 'Degrees North latitude'),
    longitude: column('Long', [44, 48], 'F5.1', 'deg', 'Degrees West longitude'), value: column('Power', [66, 72], 'F7.2', 'GW', 'Hot spot thermal emission (4)')},
  classes: [{category: 'weak', below: 10, diameterDegrees: 4}, {category: 'strong', minimum: 10, diameterDegrees: 8, outlineDegrees: 1}],
  outlineCategory: 'outline',
  categories: [{value: 'weak', label: 'Under 10 GW', color: '#ff0000'}, {value: 'strong', label: '10 GW or more', color: '#ffff00'}, {value: 'outline', label: 'Outline', color: '#000000'}]};
const rows = [row(1, '0.', '90.', '1.'), row(2, '10.', '300.', '10.'), row(3, '11.', '302.', '20.')];

test('west longitudes become east longitudes, and symbols sit at their table positions', () => {
  const parsed = parsePointTable(table(rows), lens);
  assert.deepEqual(parsed.map(point => point.longitudeEast), [270, 60, 58]);
  const sampler = createPointTableSampler(parsed, lens);
  assert.equal(sampler.sample(270, 0), 0, '90°W is 270°E: the weak symbol');
  assert.equal(sampler.sample(90, 0), null, 'the mirrored longitude holds nothing');
  assert.equal(sampler.sample(271.9, 0), 0);
  assert.equal(sampler.sample(272.1, 0), null, 'a 4° symbol reaches 2° from its centre');
  assert.equal(sampler.sample(60, 10), 1);
  assert.equal(sampler.sample(60, 5.5), 2, 'the outline ring lies outside the 4° fill radius');
  assert.equal(sampler.sample(60, 4.5), null);
  assert.equal(sampler.sample(59, 10.5), 1, 'the later row is drawn on top of the earlier one');
  assert.equal(sampler.sample(270, 91), null);
});

test('class bounds are lower-inclusive and the table must match its recipe', () => {
  assert.equal(pointClassIndex(9.99, validatePointTableProfile(lens).classes), 0);
  assert.equal(pointClassIndex(10, validatePointTableProfile(lens).classes), 1);
  assert.throws(() => parsePointTable(table(rows, 'Degrees East longitude'), lens), /column Long differs/);
  assert.throws(() => parsePointTable(table(rows.slice(0, 2)), lens), /2 rows, not 3/);
  assert.throws(() => parsePointTable(table([rows[1], rows[0], rows[2]]), lens), /out of order/);
  assert.throws(() => parsePointTable(table(rows).replace('Example hot spots', 'Other'), lens), /title/);
  assert.throws(() => validatePointTableProfile({...lens, classes: [lens.classes[0], {...lens.classes[1], minimum: 5}]}), /bounded consecutive/);
  assert.throws(() => validatePointTableProfile({...lens, outlineCategory: undefined}), /bounded consecutive/);
});
