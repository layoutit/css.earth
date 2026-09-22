import assert from 'node:assert/strict';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { sourceTest } from '../../tests/objects/source-test.mts';
const test = sourceTest();
import { citePinnedFacts, conversionsFor, discoveryMatches, displayedValue, equalAtDisplayedPrecision, fieldMeasures, parseHorizonsElements, parseSatelliteTable, recordCitation, recordLeaves, smallBodyQuery, statedNumbers } from './cite-pinned-facts.mts';

const ELEMENTS = [
  '# https://ssd.jpl.nasa.gov/api/horizons.api?format=text&COMMAND=%27588%3B%27&EPHEM_TYPE=ELEMENTS',
  'Start time      : A.D. 2026-Sep-03 00:00:00.0000 TDB',
  '            JDTDB,            Calendar Date (TDB),                     EC,                     QR,                      A,                     PR,',
  '$$SOE',
  '2461286.500000000, A.D. 2026-Sep-03 00:00:00.0000,  1.480262203421814E-01,  6.648240152588009E+08,  7.803338918784760E+08,  4.351420100615534E+03,',
  '$$EOE', '',
].join('\n');
const SBDB = { object: { des: '5535', fullname: '5535 Annefrank (1942 EM)', orbit_class: { code: 'MBA', name: 'Main-belt Asteroid' } }, orbit: { elements: [{ name: 'a', value: '2.212' }, { name: 'per', value: '1201.5' }] },
  phys_par: [{ name: 'diameter', value: '4.8', units: 'km' }, { name: 'extent', value: '6.6 x 5.0 x 3.4', units: 'km' }, { name: 'rot_per', value: '15.12', units: 'h' }],
  discovery: { who: 'Reinmuth, K.', date: '1942-Mar-23', location: 'Heidelberg' } };
const ELEM_TABLE = '<table><tr><th>ID</th><th>Planet</th><th>Satellite</th><th>a (km)</th><th>P (days)</th></tr><tr><td>9</td><td>Jupiter</td><td>Adrastea</td><td>129000.</td><td>0.298260</td></tr></table>';
const DISC_TABLE = '<table><tr><th>IAU number</th><th>IAU name</th><th>year discovered</th><th>discoverer(s)/spacecraft mission</th></tr><tr><td>XV</td><td>Adrastea</td><td>1979</td><td>Voyager Science Team</td></tr></table>';

test('displayed values, discovery names and small-body queries follow the records', () => {
  assert.deepEqual(displayedValue('About 129,000 km'), { value: 129000, decimals: 0, unit: 'km' });
  assert.deepEqual(displayedValue('13.33 ± 0.03 h'), { value: 13.33, decimals: 2, unit: 'hour' });
  assert.equal(displayedValue('Assumed synchronous; poorly constrained'), null);
  assert.ok(equalAtDisplayedPrecision({ value: 5.216, decimals: 3, unit: 'au' }, 5.21625));
  assert.ok(!equalAtDisplayedPrecision({ value: 5.22, decimals: 2, unit: 'au' }, 5.2263));
  assert.ok(discoveryMatches('Karl Reinmuth · 1942', 'Reinmuth, K.', '1942'));
  assert.ok(discoveryMatches('Cassini imaging team · 2008', 'Cassini Imaging Science Team', '2008'));
  assert.ok(!discoveryMatches('David Jewitt and G. Edward Danielson · 1979', 'Voyager Science Team', '1979'), 'different discoverers are not the same fact');
  assert.ok(!discoveryMatches('Karl Reinmuth · 1943', 'Reinmuth, K.', '1942'));
  assert.equal(smallBodyQuery('asteroid-2002-tc302', 'Asteroid 2002 TC302'), '2002 TC302');
  assert.equal(smallBodyQuery('comet-17p', 'Comet 17P/Holmes'), '17P');
  assert.equal(smallBodyQuery('comet-c2020-f3', 'Comet C/2020 F3'), 'C/2020 F3');
  assert.equal(smallBodyQuery('annefrank', 'Annefrank'), 'Annefrank');
  assert.deepEqual(parseSatelliteTable(ELEM_TABLE)[1], ['9', 'Jupiter', 'Adrastea', '129000.', '0.298260']);
});

async function fixture(panel: unknown, files: Record<string, string>) {
  const root = await mkdtemp(join(tmpdir(), 'cssearth-cite-facts-'));
  await mkdir(join(root, 'source/content'), { recursive: true });
  await mkdir(join(root, 'source/reference'), { recursive: true });
  await mkdir(join(root, 'source/editorial'), { recursive: true });
  for (const [path, text] of Object.entries(files)) await writeFile(join(root, 'source', path), text);
  await writeFile(join(root, 'source/manifest.json'), JSON.stringify({ inputs: [], documents: Object.keys(files).map(path => ({ path })) }));
  await writeFile(join(root, 'source/content/object.json'), JSON.stringify({ schema: 'cssearth-object-content@1', panel }));
  return root;
}
const facts = async (root: string) => JSON.parse(await readFile(join(root, 'source/content/object.json'), 'utf8')).panel;

test('a fact is cited only when it equals the pinned Horizons record at its displayed precision', async () => {
  const authored = { id: 'radius', label: 'Display reference radius', value: '65.5 km', source: { url: 'https://doi.org/x', label: 'Paper', checked: '2026-09-08', catalogueId: 'paper' } };
  const panel = { facts: [authored, { id: 'distance-from-sun', label: 'Solar semimajor axis', value: '5.216 AU' }, { id: 'orbital-period', label: 'Orbital period', value: '11.91 years' }, { id: 'perihelion', label: 'Perihelion', value: '4.40 AU' }] };
  const root = await fixture(panel, { 'reference/horizons-elements.txt': ELEMENTS });
  try {
    assert.deepEqual((await citePinnedFacts(root, { write: false })).cited, ['distance-from-sun', 'orbital-period']);
    assert.deepEqual(await facts(root), panel, 'check mode writes nothing');
    assert.deepEqual((await citePinnedFacts(root)).cited, ['distance-from-sun', 'orbital-period']);
    const written = (await facts(root)).facts;
    assert.deepEqual(written[0], authored, 'an authored citation is kept');
    assert.deepEqual(written[1].source, {
      url: 'https://ssd.jpl.nasa.gov/api/horizons.api?format=text&COMMAND=%27588%3B%27&EPHEM_TYPE=ELEMENTS', label: 'JPL Horizons, 2026-09-03 epoch',
      checked: '2026-09-16', path: 'source/reference/horizons-elements.txt', catalogueId: 'jpl-horizons', locator: '$$SOE first epoch; A (km) / 149597870.7',
    });
    assert.equal(written[2].source.locator, '$$SOE first epoch; PR (days) / 365.25');
    assert.equal(written[3].source, undefined, 'QR is 4.444 AU, so 4.40 AU came from elsewhere');
    assert.deepEqual(await citePinnedFacts(root), { cited: [], pruned: [], fetched: [] }, 'a second run finds nothing left to cite');
    assert.equal(parseHorizonsElements('no header'), null);
  } finally { await rm(root, { recursive: true, force: true }); }
});

test('small-body records cite dimensions, class, discovery and rotation; pruning drops what no record proves', async () => {
  const panel = { facts: [
    { id: 'shape', label: 'Shape', value: 'Approximate ellipsoid' },
    { id: 'dimensions', label: 'Dimensions', value: '6.6 × 5 × 3.4 km' },
    { id: 'rotation', label: 'Rotation', value: '15.12 hours' },
    { id: 'class', label: 'Class', value: 'Main-belt asteroid' },
  ], moreFacts: [{ id: 'discovery', label: 'Discovery', value: 'Karl Reinmuth · 1942' }, { id: 'radius', label: 'Radius', value: '2.5 km' }] };
  const root = await fixture(panel, { 'reference/sbdb.json': JSON.stringify(SBDB) });
  try {
    const run = await citePinnedFacts(root, { prune: true });
    assert.deepEqual(run, { cited: ['dimensions', 'rotation', 'class', 'discovery'], pruned: ['shape', 'radius'], fetched: [] });
    const written = await facts(root);
    assert.deepEqual(written.facts.map((fact: { id: string }) => fact.id), ['dimensions', 'rotation', 'class']);
    assert.deepEqual(written.moreFacts.map((fact: { id: string }) => fact.id), ['discovery']);
    assert.equal(written.facts[0].source.locator, 'phys_par.extent (km)');
    assert.equal(written.facts[0].source.url, 'https://ssd.jpl.nasa.gov/tools/sbdb_lookup.html#/?sstr=5535');
    assert.equal(written.moreFacts[0].source.locator, 'discovery.who; discovery.date');
  } finally { await rm(root, { recursive: true, force: true }); }
});

test('satellite rows are copied into the source review once and cite orbit, radius and discovery', async () => {
  const panel = { facts: [
    { id: 'orbital-period', label: 'Orbit around Jupiter', value: 'About 7.16 hours' },
    { id: 'distance-from-parent', label: 'Mean distance from Jupiter', value: 'About 129,000 km' },
    { id: 'discovery', label: 'Discovery', value: 'David Jewitt and G. Edward Danielson · 1979' },
  ] };
  const root = await fixture(panel, {});
  try {
    const tables = new Map([['elements', parseSatelliteTable(ELEM_TABLE)], ['discovery', parseSatelliteTable(DISC_TABLE)]] as const);
    const run = await citePinnedFacts(root, { classification: 'satellite', name: 'Adrastea', satelliteTables: new Map(tables) });
    assert.deepEqual(run.cited, ['orbital-period', 'distance-from-parent']);
    const review = JSON.parse(await readFile(join(root, 'source/editorial/factsheet-review.json'), 'utf8'));
    assert.equal(review.schema, 'cssearth-factsheet-source-review@1');
    assert.deepEqual(review.references.map((reference: { url: string }) => reference.url), ['https://ssd.jpl.nasa.gov/sats/elem/', 'https://ssd.jpl.nasa.gov/sats/discovery.html']);
    const manifest = JSON.parse(await readFile(join(root, 'source/manifest.json'), 'utf8'));
    assert.ok(manifest.documents.some((entry: { path: string }) => entry.path === 'editorial/factsheet-review.json'), 'the review is pinned');
    const written = (await facts(root)).facts;
    assert.deepEqual(written[0].source, { url: 'https://ssd.jpl.nasa.gov/sats/elem/', label: 'JPL Planetary Satellite Mean Orbital Parameters', checked: '2026-09-16', path: 'source/editorial/factsheet-review.json', catalogueId: 'jpl-satellite-mean-elements', locator: '/references/0; P (days) × 24' });
    assert.equal(written[2].source, undefined, 'Voyager Science Team is not Jewitt and Danielson');
    const again = await citePinnedFacts(root, { classification: 'satellite', name: 'Adrastea', satelliteTables: new Map(tables) });
    assert.deepEqual(again.cited, []);
    assert.equal(JSON.parse(await readFile(join(root, 'source/editorial/factsheet-review.json'), 'utf8')).references.length, 2, 'rows are not copied twice');
  } finally { await rm(root, { recursive: true, force: true }); }
});

test('a pinned record proves a fact only through a numeric field that measures the same kind of quantity', () => {
  const catalogue = new Map([['https://arxiv.org/abs/2401.04634', { id: 'french-2024', title: 'French et al. (2024)' }]]);
  const record = (raw: unknown) => [{ path: 'measurements.json', leaves: recordLeaves(raw) }];
  const measured = record({ source: 'https://arxiv.org/abs/2401.04634', semiAxesKm: [32, 23, 23], projectedRadiusKm: { value: 27, uncertainty: 2 },
    designation: 'S/2000 S10', note: 'Axes 64 × 46 × 46 km quoted in prose', outline: { points: [[298, 1]] }, meanAnomalyDeg: 10, rotationPeriodDays: 15.771 });
  const cite = (value: string, label: string) => recordCitation(value, measured, catalogue, () => null, label);
  assert.equal(cite('64 × 46 × 46 km', 'Model dimensions')?.locator, '/semiAxesKm/0; /semiAxesKm/1', 'full axes are doubled semi-axes');
  assert.equal(cite('27 ± 2 km', 'Projected radius')?.locator, '/projectedRadiusKm/value');
  assert.equal(cite('About 15.8 days', 'Rotation period')?.catalogueId, 'french-2024');
  assert.equal(cite('10 km', 'Diameter estimate'), null, 'a number inside a designation is not a measurement');
  assert.equal(cite('596 km', 'Closest approach'), null, 'an outline coordinate is not a distance');
  assert.equal(cite('About 10 m', 'Ring thickness'), null, 'an angle is not a length');
  assert.equal(cite('About 3.3 km', 'Equivalent diameter'), null, 'no time conversion applies to a length');
  assert.equal(recordCitation('Published Jacobi ellipsoid', record({ source: 'https://arxiv.org/abs/2401.04634', shapeLabel: 'Published Jacobi ellipsoid' }), catalogue, () => null, 'Shape evidence'), null,
    'text copied into a record by the same author is not evidence');
  assert.deepEqual(statedNumbers('2,326 ± 12 km'), [{ value: 2326, decimals: 0 }]);
  assert.deepEqual(statedNumbers('157 (+23/−15) km'), [{ value: 157, decimals: 0 }]);
  assert.ok(fieldMeasures('/constraints/volumeEquivalentDiameterKm/value', '370 km', 'Size evidence'));
  assert.ok(!fieldMeasures('/moons/35/ascendingNodeDeg', 'Up to 539 km/h', 'Cloud-top winds'));
  assert.deepEqual(conversionsFor('764 solar radii'), [1, 2, 0.5, 1 / 695700]);
});
