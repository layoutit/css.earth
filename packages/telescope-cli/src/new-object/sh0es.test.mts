/** Cepheids Gaia cannot see, placed by a catalogue row (spec `position`, sh0es.mts), offline on fixtures. */
import assert from 'node:assert/strict';
import { resolve } from 'node:path';
import { sourceTest } from '@cssearth/objects/node/source-test';
import { parseCatalogueRow, type Archive } from './archives.mts';
import { cepheidRelations, draftFromHoffmann, GROENEWEGEN_2020, hostName, parseHoffmannRows } from './sh0es.mts';
import { parseStarSpec } from './spec.mts';
import { loadSolarEpoch } from './solar-epoch.mts';

const test = sourceTest(), root = resolve(import.meta.dirname, '../../../..');
// Hoffmann et al. (2016) table 5 as VizieR's ASU TSV serves it, with the dated comment lines already dropped.
const table = ['Gal\tRAJ2000\tDEJ2000\tID\tPer\tF555W\tF814W\tSimbadName', ' \tdeg\tdeg\t \td\tmag\tmag\t', '-----\t---------\t---------\t--------\t------\t------\t------\t-----------------------'];
const row = (host: string, id: string, period: number) => `${host}\t188.59811\t+02.17822\t   ${id}\t${period}\t26.625\t25.953\t[HMR2016] ${host}  ${id}`;
const velocity = { value: 1802, uncertainty: 3, source: "SIMBAD's radial velocity of NGC 4536", url: 'https://ui.adsabs.harvard.edu/abs/2022ApJS..261...21Y/abstract' };

test("Groenewegen's two period relations give the radius, and with the luminosity the temperature, at a period", () => {
  const at10 = cepheidRelations(10);
  assert.ok(Math.abs(at10.radius - 63.68) < 0.01, 'log R = 0.721 + 1.083 at log P = 1');
  assert.ok(Math.abs(at10.luminosity - 2937.6) < 0.1, 'M_bol = -3.93 against the nominal solar 4.74');
  assert.ok(Math.abs(at10.temperature - 5325) < 1);
  assert.ok(cepheidRelations(30).temperature < at10.temperature, 'longer periods are cooler');
});

test('a Hoffmann row becomes a spec the parser accepts, at its galaxy\'s Riess et al. distance, with the relations named as such', () => {
  const [parsed] = parseHoffmannRows([...table, row('N4536', '38676', 11.854)].join('\n'));
  assert.deepEqual([parsed!.host, parsed!.id, parsed!.simbad], ['N4536', '38676', '[HMR2016] N4536 38676']);
  const draft = draftFromHoffmann(parsed!, velocity), spec = parseStarSpec(draft);
  assert.equal(spec.id, 'ngc-4536-cepheid-38676');
  assert.deepEqual(spec.position?.row, { Gal: 'N4536', ID: '38676' });
  assert.equal(spec.distance?.value, 15177492, '10^(30.906/5 + 1) pc');
  assert.equal(spec.distance?.uncertainty, 370443);
  assert.equal(spec.radialVelocity?.value, 1802, "a galaxy's recession is inside the range a catalogue-placed star allows");
  assert.equal(spec.mass, 'unmeasured');
  assert.match(spec.radius === 'gaia-flame' ? '' : spec.radius.source, /not a measurement of this star/u);
  assert.equal(spec.temperature.uncertainty, GROENEWEGEN_2020.temperatureRmsK);
  assert.ok(!spec.notes.some(note => /extrapolated/u.test(note)));
  const [long] = parseHoffmannRows([...table, row('N4536', '1', 80)].join('\n'));
  assert.ok(parseStarSpec(draftFromHoffmann(long!, velocity)).notes.some(note => /longer than any in the relations' sample \(68\.464 d\)/u.test(note)));
  const [maser] = parseHoffmannRows([...table, row('N4258', '2', 10)].join('\n'));
  assert.throws(() => draftFromHoffmann(maser!, velocity), /Riess et al\. \(2016\) table 5 gives NGC 4258 no Cepheid distance \(it is the maser anchor\)/u);
  assert.equal(hostName('U9391'), 'UGC 9391'); assert.equal(hostName('M101'), 'M 101');
  assert.throws(() => hostName('NGC4536'), /not a host as Hoffmann et al\. \(2016\) table 5 writes it/u);
});

test('a catalogue-placed star cites what Gaia would have given, and its row must be exactly one', () => {
  const [parsed] = parseHoffmannRows([...table, row('N4536', '38676', 11.854)].join('\n')), draft = draftFromHoffmann(parsed!, velocity);
  assert.throws(() => parseStarSpec({ ...draft, gaia: '123456789' }), /has no Gaia DR3 source; give position or gaia, not both/u);
  const { distance: _distance, radialVelocity: _velocity, ...bare } = draft;
  assert.throws(() => parseStarSpec(bare), /J\/ApJ\/830\/10\/table5 has no Gaia DR3 row; give distance, radialVelocity/u);
  assert.throws(() => parseStarSpec({ ...draft, radialVelocity: { ...velocity, value: 1802 }, position: undefined, target: 'x' }), /radialVelocity\.value 1802 is outside -1000 to 1000/u);
  const position = { catalogue: 'J/ApJ/830/10/table5', row: { Gal: 'N4536', ID: '38676' }, credit: 'Hoffmann et al. (2016), table 5', url: 'https://arxiv.org/abs/1607.08658' };
  const found = parseCatalogueRow([...table, row('N4536', '38676', 11.854)].join('\n'), position, 'test');
  assert.deepEqual([found.ra, found.dec], [188.59811, 2.17822]);
  assert.throws(() => parseCatalogueRow(table.join('\n'), position, 'test'), /test: VizieR J\/ApJ\/830\/10\/table5 row Gal = N4536, ID = 38676 matches 0 rows, not one/u);
  assert.throws(() => parseCatalogueRow([...table, row('N4536', '386760', 11.854)].join('\n'), position, 'test'), /the row found has ID = 386760, not 38676/u);
});

test('a whole package for a star Gaia cannot see: the archived row placed and declared, no Gaia file, cited distance and velocity', async () => {
  const { generateStar, CATALOGUE_ROW_PATH } = await import('./generate.mts');
  const [parsed] = parseHoffmannRows([...table, row('N4536', '38676', 11.854)].join('\n'));
  const spec = parseStarSpec({ ...draftFromHoffmann(parsed!, velocity), limb: { none: 'a test fixture' } });
  const arxiv = '<feed><entry><title>A paper</title><published>2016-01-01T00:00:00Z</published><author><name>S Hoffmann</name></author></entry></feed>';
  const archive: Archive = {
    async text(url, form) {
      if (url.includes('asu-tsv') && form?.['-source'] === 'J/ApJ/830/10/table5') return ['#', '#   VizieR Astronomical Server', ...table, row('N4536', '38676', 11.854), ''].join('\n');
      if (url.includes('export.arxiv.org')) return arxiv; if (url.includes('asu-tsv')) return '#\n'; throw new Error(`unexpected ${url}`);
    },
    async bytes() { return Buffer.from(''); }, async exists() { return false; } };
  const generated = await generateStar(spec, { archive, root, order: 9997, universe: { ids: new Set(), names: new Map(), stars: [] }, solarEpoch: await loadSolarEpoch(root),
    resolver: async () => { throw new Error('a catalogue-placed star is not resolved through SIMBAD'); } });
  const o = `src/objects/${spec.id}`, files = generated.files, manifest = JSON.parse(String(files.get(`${o}/source/manifest.json`)));
  const declared = [...manifest.inputs, ...manifest.documents, ...manifest.generatedIntermediates ?? []].map((entry: { path: string }) => entry.path);
  for (const path of files.keys()) if (path.startsWith(`${o}/source/`) && !path.endsWith('manifest.json')) assert.ok(declared.includes(path.slice(`${o}/source/`.length)), `${path} is not declared`);
  for (const input of manifest.inputs) assert.ok(input.sourceBinding, `input ${input.id} has no source binding`);
  assert.ok(declared.includes(CATALOGUE_ROW_PATH)); assert.ok(!files.has(`${o}/source/photometry/gaia-dr3-source.csv`)); assert.ok(!files.has(`src/sources/gaia-dr3-${spec.id}.json`));
  assert.match(String(files.get(`${o}/source/${CATALOGUE_ROW_PATH}`)), /^Gal\tRAJ2000/u, 'the dated comment lines are dropped');
  const body = JSON.parse(String(files.get(`packages/astronomy/data/bodies/${spec.id}.json`)));
  assert.deepEqual([body.star.rightAscensionDegrees, body.star.declinationDegrees, body.star.positionEpochJulianYear, body.star.distanceParsecs, body.star.radialVelocityKmPerS], [188.59811, 2.17822, 2000, 15177492, 1802]);
  assert.match(body.star.sources.position, /Hoffmann et al\. \(2016\), ApJ 830, 10, table 5 .*RAJ2000 188\.59811, DEJ2000 2\.17822.*SIMBAD names it \[HMR2016\] N4536 38676/u);
  assert.match(body.star.sources.properMotion, /measures no proper motion; zero is assumed/u);
  const operation = JSON.parse(String(files.get(`${o}/source/preparation/acquisition.json`))).operations.find((entry: { path: string }) => entry.path === CATALOGUE_ROW_PATH);
  assert.deepEqual(operation.form, { '-source': 'J/ApJ/830/10/table5', '-out.all': '', '-out.max': '2', Gal: 'N4536', ID: '38676' });
  assert.match(generated.color.summary, /Planck spectrum at 5,270 K/u);
});
