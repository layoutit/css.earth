/** The object generator's decisions, offline: the spec it accepts, the colour route it picks and the gaps it declares, the orbits it
 * writes from each route, checked against packages that already ship. */
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { gzipSync } from 'node:zlib';
import { sourceTest } from '../../../tests/objects/source-test.mts';
import { parseCieTable } from '../observation/disc-integrated-color.mts';
import { readIdentifiers, type Archive, type GaiaRow } from './archives.mts';
import { chooseColor, coverageGaps } from './color.mts';
import { archiveHostedOrbit, orbitizeHostedOrbit, parseArchiveRows } from './orbit.mts';
import { parseObjectSpecs, parseStarSpec } from './spec.mts';

const test = sourceTest(), root = resolve(import.meta.dirname, '../../..');
const star = { id: 'test-star', name: 'Test Star', description: 'A test.', gaia: '123456789', paper: { url: 'https://arxiv.org/abs/2110.06729', credit: 'Willamo et al. (2022)' },
  radius: { value: 1, source: 'a paper', url: 'https://arxiv.org/abs/2110.06729' }, mass: 'gaia-flame', temperature: { value: 5800, source: 'a paper', url: 'https://arxiv.org/abs/2110.06729' } };

test('a spec is checked before any archive is read', () => {
  assert.equal(parseStarSpec(star).system, 'Test Star system');
  assert.throws(() => parseStarSpec({ ...star, gaia: undefined }), /give target \(a SIMBAD name\) or gaia/u);
  assert.throws(() => parseStarSpec({ ...star, temperature: { ...star.temperature, url: 'a paper' } }), /https URL/u);
  assert.throws(() => parseStarSpec({ ...star, colour: {} }), /unknown spec fields colour/u);
  assert.throws(() => parseStarSpec({ ...star, color: { skip: ['hubble'], reason: 'x' } }), /hubble are not colour routes/u);
  const planet = { id: 'test-star-b', name: 'Test Star b', description: 'A planet.', paper: star.paper, orbit: { elements: { periodDays: 3, semiMajorAxisStellarRadii: 9, inclinationDegrees: 88, eccentricity: 0, transitTimeBmjdTdb: 59000 }, source: 's', url: 'https://arxiv.org/abs/2110.06729' } };
  assert.throws(() => parseStarSpec({ ...star, planets: [planet] }), /give radius and mass/u);
  const sized = { ...planet, radius: { value: 1, source: 's', url: star.paper.url }, mass: { value: 1, source: 's', url: star.paper.url } };
  const eccentric = { ...sized, orbit: { ...sized.orbit, elements: { ...sized.orbit.elements, eccentricity: 0.1 } } };
  assert.throws(() => parseStarSpec({ ...star, planets: [eccentric] }), /eccentric orbit needs argumentOfPeriapsisDegrees and epoch/u);
  assert.throws(() => parseObjectSpecs({ stars: [star, { host: 'vega', planets: [{ ...sized, id: 'test-star', orbit: { archive: 'nasa-ps' } }] }] }), /Object ids repeat: test-star/u);
  assert.deepEqual(parseObjectSpecs({ stars: [{ host: 'vega', planets: [{ ...sized, orbit: { archive: 'nasa-ps' } }] }] }).additions[0]!.host, 'vega');
});

test('SIMBAD identifiers give the numbers the archives are searched by', () => {
  assert.deepEqual(readIdentifiers('* chi01 Ori', ['HIP 27913', 'HD  39587', 'HR 2047', 'Gaia DR3 3399063235755057792', 'NAME Test']),
    { main: '* chi01 Ori', hip: 27913, hd: 39587, hr: 2047, gaia: '3399063235755057792' });
});

test('coverage gaps are declared where the reader would find none, and nowhere else', () => {
  const kharitonov = Array.from({ length: 88 }, (_, k) => 322.5 + 5 * k);
  assert.deepEqual(coverageGaps(kharitonov).map(gap => [gap.fromNm, gap.toNm]), [[757.5, 780]]);
  assert.deepEqual(coverageGaps(Array.from({ length: 401 }, (_, i) => 380 + i)), []);
  assert.deepEqual(coverageGaps([400, 405, 430, 435, 780]).map(gap => [gap.fromNm, gap.toNm]), [[380, 400], [405, 430], [435, 780]]);
});

/** A Kharitonov catalog.dat line: running number, position, HR, HD, V, type, then 88 fluxes (I7) from byte 80. */
const kharitonovLine = (record: number, hr: number, flux: (nm: number) => number) =>
  `${String(record).padStart(4, '0')} 05 54 23.5 +20 16 38 ${String(hr).padStart(5, '0')}     039587     4.41     G0V`.padEnd(79)
  + Array.from({ length: 88 }, (_, k) => String(Math.round(flux(322.5 + 5 * k))).padStart(7)).join('');

test('the colour comes from the first route that reads, the cross-check from the next, and Planck only when none does', async () => {
  const cmf = parseCieTable(await readFile(resolve(root, 'src/objects/hd-189733/source/reference/CIE_xyz_1931_2deg.csv'), 'utf8'), 3);
  const catalog = Buffer.from([kharitonovLine(1, 15, () => 500), kharitonovLine(2, 2047, nm => 400 + nm / 10)].join('\n'));
  const archive: Archive = {
    async text() { return '#\nlambda\tm(HR9999)\n'; },
    async bytes(url) { if (url.endsWith('III/202/catalog.dat')) return catalog; throw new Error(`unexpected ${url}`); },
    async exists() { return false; },
  };
  const row = { sourceId: '1', hasXpSampled: false } as GaiaRow, spec = parseStarSpec(star);
  const found = await chooseColor(spec, row, { main: 'x', hd: 39587, hr: 2047 }, { ...archive, async bytes(url) { if (url.includes('III/201')) return Buffer.from(''); if (url.includes('III/126')) return gzipSync(''); return archive.bytes(url); } }, cmf);
  assert.equal(found.route, 'kharitonov');
  assert.deepEqual((found.record.measuredSpectrum as { flux: { column: string } }).flux.column, '2', 'the record whose HR is 2047');
  assert.deepEqual((found.record.measuredSpectrum as { gaps: { fromNm: number }[] }).gaps.map(gap => gap.fromNm), [757.5]);
  assert.match(found.tried.join('; '), /stis-ngsl: HD 39587 is not in the library; gaia-xp: Gaia DR3 published no sampled BP\/RP spectrum/u);
  const none = await chooseColor(spec, row, { main: 'x' }, archive, cmf);
  assert.equal(none.route, 'planck');
  assert.match(String((none.record.temperature as { published: { citation: string } }).published.citation), /no uncertainty/u);
});

test('an imaged orbit from the paper\'s posterior is the orbit GJ 504 b ships', async () => {
  const shipped = JSON.parse(await readFile(resolve(root, 'packages/astronomy/data/bodies/gj-504-b.json'), 'utf8')).hostedOrbit, host = JSON.parse(await readFile(resolve(root, 'packages/astronomy/data/bodies/gj-504.json'), 'utf8'));
  const orbit = orbitizeHostedOrbit(JSON.parse(await readFile(resolve(root, 'src/objects/gj-504-b/source/orbits/orbit.json'), 'utf8')), host.physical.meanRadiusKm, host.star.distanceParsecs,
    'Bowler et al. (2020)', 'src/objects/gj-504-b/source/orbits/pick.json');
  for (const key of ['periodDays', 'semiMajorAxisStellarRadii', 'inclinationDegrees', 'eccentricity', 'argumentOfPeriapsisDegrees', 'epochDefinition', 'transitTimeBmjdTdb', 'ascendingNodePositionAngleDegrees'] as const) {
    assert.equal(orbit[key], shipped[key], key);
  }
});

test('a transiting orbit is one paper\'s archive row, and an eccentric row states its epoch', () => {
  const csv = 'pl_name,pl_refname,default_flag,pl_orbper,pl_ratdor,pl_orbincl,pl_orbeccen,pl_orblper,pl_tranmid,pl_radj,pl_bmassj\n'
    + '"WASP-121 b","<a refstr=BOURRIER_ET_AL__2020 href=https://ui.adsabs.harvard.edu/abs/2020A&A...635A.205B/abstract target=ref>Bourrier et al. 2020</a>",0,1.27492504000,3.813100,88.49000,0.000000,10.0000,2458119.72074000,1.75300000,1.15700000\n'
    + '"X b","<a refstr=A_ET_AL__2019 href=https://ui.adsabs.harvard.edu/abs/2019AJ....157...1A/abstract target=ref>A et al. 2019</a>",1,5.0,12.0,87.0,0.2,95.0,2458000.5,1.0,1.0';
  const [wasp, eccentric] = parseArchiveRows(csv);
  assert.deepEqual([wasp!.bibcode, wasp!.reference, wasp!.isDefault], ['2020A&A...635A.205B', 'BOURRIER_ET_AL__2020', false]);
  const { orbit } = archiveHostedOrbit(wasp!);
  assert.deepEqual([orbit.periodDays, orbit.semiMajorAxisStellarRadii, orbit.inclinationDegrees, orbit.eccentricity, orbit.transitTimeBmjdTdb, orbit.epochDefinition], [1.27492504, 3.8131, 88.49, 0, 58119.22074, undefined]);
  const second = archiveHostedOrbit(eccentric!);
  assert.deepEqual([second.orbit.epochDefinition, second.orbit.argumentOfPeriapsisDegrees], ['inferior-conjunction', 95]);
  assert.match(second.todo!, /convention for omega/u);
});
