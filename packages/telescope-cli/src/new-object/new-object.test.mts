/** The object generator's decisions, offline: the spec it accepts, the color route it picks and the gaps it declares, the orbits it
 * writes from each route, checked against packages that already ship. */
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { gzipSync } from 'node:zlib';
import { sourceTest } from '@cssearth/objects/node/source-test';
import { parseCieTable } from '@cssearth/bake/objects/color';
import { readCie1931ColorMatching } from '@cssearth/bake/objects/sources';
import { readIdentifiers, type Archive, type GaiaRow } from './archives/archives.mts';
import { chooseColor, coverageGaps } from './color.mts';
import { assembleArchiveOrbit, orbitizeHostedOrbit, parseArchiveRows } from './orbit.mts';
import { parseObjectSpecs, parseStarSpec } from './spec.mts';
import { loadSolarEpoch } from './solar-epoch.mts';

const test = sourceTest(), root = resolve(import.meta.dirname, '../../../..');
const star = { id: 'test-star', name: 'Test Star', description: 'A test.', gaia: '123456789', paper: { url: 'https://arxiv.org/abs/2110.06729', credit: 'Willamo et al. (2022)' },
  radius: { value: 1, source: 'a paper', url: 'https://arxiv.org/abs/2110.06729' }, mass: 'gaia-flame', temperature: { value: 5800, source: 'a paper', url: 'https://arxiv.org/abs/2110.06729' } };

test('a spec is checked before any archive is read', () => {
  assert.equal(parseStarSpec(star).system, 'Test Star system');
  assert.throws(() => parseStarSpec({ ...star, gaia: undefined }), /give target \(a SIMBAD name\), gaia \(a Gaia DR3 source_id\) or position/u);
  assert.throws(() => parseStarSpec({ ...star, temperature: { ...star.temperature, url: 'a paper' } }), /https URL/u);
  assert.throws(() => parseStarSpec({ ...star, hue: {} }), /unknown spec fields hue/u);
  assert.throws(() => parseStarSpec({ ...star, color: { skip: ['hubble'], reason: 'x' } }), /hubble are not color routes/u);
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

test('the color comes from the first route that reads, the cross-check from the next, and Planck only when none does', async () => {
  const cmf = parseCieTable((await readCie1931ColorMatching()).toString('utf8'), 3);
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
  // A star Gaia saturates on (G under 4) is read from the ground catalogues first: Gaia's spectrum is tried last.
  const bright = await chooseColor(spec, { ...row, g: 3.07 }, { main: 'x' }, archive, cmf), faint = await chooseColor(spec, { ...row, g: 4.3 }, { main: 'x' }, archive, cmf);
  assert.match(bright.tried.at(-1)!, /^gaia-xp: /u); assert.match(faint.tried[1]!, /^gaia-xp: /u);
  const none = await chooseColor(spec, row, { main: 'x' }, archive, cmf);
  assert.equal(none.route, 'planck');
  assert.match(String((none.record.temperature as { published: { citation: string } }).published.citation), /no uncertainty/u);
  // Routes the spec skips are not archives that lack the star: the spec's reason is the Planck color's reason, said once.
  const reason = 'Dust reddens every spectrum of this star';
  const skipped = await chooseColor(parseStarSpec({ ...star, color: { skip: ['stis-ngsl', 'gaia-xp', 'pulkovo', 'kiehling', 'kharitonov', 'burnashev'], reason } }), row, { main: 'x', hd: 39587, hr: 2047 }, archive, cmf);
  assert.equal(skipped.route, 'planck');
  assert.equal(skipped.summary.split(reason.toLowerCase()).length + skipped.summary.split(reason).length - 2, 1, skipped.summary);
  assert.doesNotMatch(skipped.summary, /[Nn]o archive holds a spectrum/u);
  assert.deepEqual(skipped.tried, ['stis-ngsl: skipped', 'gaia-xp: skipped', 'pulkovo: skipped', 'kiehling: skipped', 'kharitonov: skipped', 'burnashev: skipped']);
});

test('a black hole companion is a record only: a mass, no temperature, and no radius unless one is measured', async () => {
  const cited = { value: 21.2, source: 'Miller-Jones et al. (2021), Table 1', url: 'https://arxiv.org/abs/2102.09091' };
  const orbit = { elements: { periodDays: 5.599836, semiMajorAxisStellarRadii: 2.3528, inclinationDegrees: 152.49, eccentricity: 0.0189, argumentOfPeriapsisDegrees: 126.6, transitTimeBmjdTdb: 41160.8322, ascendingNodePositionAngleDegrees: 64.1 }, epoch: 'periastron', source: 's', url: cited.url };
  const hole = { id: 'test-hole', name: 'Test Hole', description: 'A black hole.', paper: star.paper, blackHole: true, mass: cited, orbit };
  const spec = parseStarSpec({ ...star, companions: [hole] }).companions[0]!;
  assert.equal(spec.blackHole, true);
  assert.throws(() => parseStarSpec({ ...star, companions: [{ ...hole, temperature: { ...cited, value: 1e4 } }] }), /a black hole has no effective temperature/u);
  assert.throws(() => parseStarSpec({ ...star, companions: [{ ...hole, mass: undefined }] }), /a black hole needs its cited mass/u);
  assert.throws(() => parseStarSpec({ ...star, planets: [{ ...hole, radius: cited }] }), /only a companion may be a black hole/u);
  const { hostedRecord } = await import('./hosted.mts');
  const host = { spec: { id: 'test-star', system: 'Test system' } as never, body: { physical: { meanRadiusKm: 15514110 }, star: { distanceParsecs: 2252.75 } } };
  const record = await hostedRecord(spec, host, 1, {} as Archive, root);
  const body = record.body as { classification: string; physical: Record<string, unknown>; physicalNotes: string };
  assert.equal(body.classification, 'black-hole');
  assert.equal(body.physical.meanRadiusKm, 0, 'no source measures its size');
  assert.equal(body.physical.effectiveTemperatureK, undefined);
  assert.match(body.physicalNotes, /No source measures a size/u);
  assert.equal(record.radius, undefined);
});

test('a body another owner records is packaged from that record, and the spec\'s cited values must reproduce it', async () => {
  const s2 = JSON.parse(await readFile(resolve(root, 'packages/astronomy/data/bodies/s2.json'), 'utf8'));
  const cite = (value: number) => ({ value, source: 'Habibi et al. (2017), Table 3', url: 'https://arxiv.org/abs/1708.06353' });
  const entry = { id: 's2', name: 'S2', description: 'A star.', paper: { url: 'https://arxiv.org/abs/2112.07478', credit: 'GRAVITY (2022)' }, radius: cite(5.53), mass: cite(13.6), temperature: cite(28513),
    orbit: { record: true, source: 'GRAVITY Collaboration (2022), Table 1', url: 'https://arxiv.org/abs/2112.07478' } };
  const spec = parseObjectSpecs([{ host: 'sgr-a-star', companions: [entry] }]).additions[0]!.companions[0]!;
  assert.throws(() => parseObjectSpecs([{ host: 'sgr-a-star', companions: [{ ...entry, orbit: { record: 'yes' } }] }]), /record is true or absent/u);
  const { hostedRecord } = await import('./hosted.mts'), host = { spec: { id: 'sgr-a-star', system: 'Sagittarius A* system' } as never, body: {} };
  const kept = await hostedRecord(spec, host, 0, {} as Archive, root);
  assert.equal(kept.kept, true);
  assert.deepEqual(kept.body, s2, 'the record is kept as its owner wrote it');
  assert.deepEqual(kept.orbit, s2.hostedOrbit);
  await assert.rejects(hostedRecord({ ...spec, radius: cite(5.6) }, host, 0, {} as Archive, root), /s2\.json physical\.meanRadiusKm is 3847221; the spec's cited value gives 3895920/u);
  await assert.rejects(hostedRecord(spec, { ...host, spec: { id: 'vega', system: 'x' } as never }, 0, {} as Archive, root), /has parent sgr-a-star, not vega/u);
});

test('an imaged orbit from the paper\'s posterior is the orbit GJ 504 b ships', async () => {
  const shipped = JSON.parse(await readFile(resolve(root, 'packages/astronomy/data/bodies/gj-504-b.json'), 'utf8')).hostedOrbit, host = JSON.parse(await readFile(resolve(root, 'packages/astronomy/data/bodies/gj-504.json'), 'utf8'));
  const orbit = orbitizeHostedOrbit(JSON.parse(await readFile(resolve(root, 'src/objects/gj-504-b/source/orbits/orbit.json'), 'utf8')), host.physical.meanRadiusKm, host.star.distanceParsecs,
    'Bowler et al. (2020)', 'src/objects/gj-504-b/source/orbits/pick.json');
  for (const key of ['periodDays', 'semiMajorAxisStellarRadii', 'inclinationDegrees', 'eccentricity', 'argumentOfPeriapsisDegrees', 'epochDefinition', 'transitTimeBmjdTdb', 'ascendingNodePositionAngleDegrees'] as const) {
    assert.equal(orbit[key], shipped[key], key);
  }
});

test('a transiting orbit is one paper\'s archive row, with gaps filled from other rows and a/R* derived when no row has it', async () => {
  const header = 'pl_name,pl_refname,default_flag,pl_orbper,pl_ratdor,pl_orbincl,pl_orbeccen,pl_orblper,pl_tranmid,pl_radj,pl_bmassj,pl_orbsmax,st_rad,st_mass,pl_bmassjlim,pl_imppar,pl_trandur,pl_ratror,pl_orbtper,pl_orbinclerr1,pl_bmassprov,pl_orbpererr1,pl_tranmiderr1';
  const anchor = (ref: string, bib: string, label: string) => `"<a refstr=${ref} href=https://ui.adsabs.harvard.edu/abs/${bib}/abstract target=ref>${label}</a>"`;
  const csv = [header,
    `"WASP-121 b",${anchor('BOURRIER_ET_AL__2020', '2020A&A...635A.205B', 'Bourrier et al. 2020')},0,1.27492504,3.8131,88.49,0,10,2458119.72074,1.753,1.157,,1.458,1.353,0`,
    `"X b",${anchor('A_ET_AL__2019', '2019AJ....157...1A', 'A et al. 2019')},1,5.0,,87.0,0.2,95.0,2458000.5,1.0,,0.05,1.0,1.0,`,
    `"X b",${anchor('B_ET_AL__2021', '2021AJ....161...2B', 'B et al. 2021')},0,5.0,,,,,,1.1,0.9,,,,0`,
    `"Y b",${anchor('C_ET_AL__2022', '2022AJ....163...3C', 'C et al. 2022')},1,2.0,8.0,89.0,0,,2459000.5,0.2,0.05,,,,1`,
    `"Z b",${anchor('E_ET_AL__2023', '2023AJ....165...5E', 'E et al. 2023')},1,4.0,10.0,,0,,2459100.5,0.1,0.01,,,,0,0.5`,
    `"W b",${anchor('F_ET_AL__2023', '2023AJ....165...6F', 'F et al. 2023')},1,4.0,10.0,,0,,2459100.5,0.1,0.01,,,,0,12`].join('\n');
  const rows = parseArchiveRows(csv), wasp = rows.filter(row => row.name === 'WASP-121 b'), x = rows.filter(row => row.name === 'X b');
  assert.deepEqual([wasp[0]!.bibcode, wasp[0]!.reference, wasp[0]!.isDefault, wasp[0]!.year], ['2020A&A...635A.205B', 'BOURRIER_ET_AL__2020', false, 2020]);
  const { orbit } = assembleArchiveOrbit(wasp, 'BOURRIER_ET_AL__2020', { value: 1.157, provenance: 'Mass', limit: false, label: 'Bourrier et al. 2020' });
  assert.deepEqual([orbit.periodDays, orbit.semiMajorAxisStellarRadii, orbit.inclinationDegrees, orbit.eccentricity, orbit.transitTimeBmjdTdb, orbit.epochDefinition], [1.27492504, 3.8131, 88.49, 0, 58119.22074, undefined]);
  const adopted = { value: 0.9, provenance: 'Mass', limit: false, label: 'B et al. 2021', bibcode: '2021AJ....161...2B' };
  const second = assembleArchiveOrbit(x, undefined, adopted);
  // a/R* from the default row's 0.05 au and 1.0 solar radius; the mass is the one the archive's composite table adopts.
  assert.equal(second.orbit.semiMajorAxisStellarRadii, Number((0.05 / (695700 / 149597870.7)).toFixed(4)));
  assert.deepEqual([second.orbit.epochDefinition, second.orbit.argumentOfPeriapsisDegrees, second.mass.value, second.radius.row.label], ['inferior-conjunction', 95, 0.9, 'A et al. 2019']);
  assert.match(second.mass.row.label, /B et al. 2021, the mass the NASA Exoplanet Archive's composite table adopts/u);
  assert.match(second.orbit.sources.shape!, /derived from its semi-major axis 0.05 au/u);
  assert.match(second.todo!, /omega 95 degrees is taken as A et al. 2019 gives it/u);
  assert.throws(() => assembleArchiveOrbit(x.slice(1), 'B_ET_AL__2021', adopted), /no archive row gives its inclination, transit time/u);
  // No row states an inclination: the impact parameter gives it, b = a/R* cos i on a circular orbit (Winn 2010, eq. 7).
  const small = { value: 0.003, provenance: 'Mass', limit: false, label: 'E et al. 2023' }, z = assembleArchiveOrbit(rows.filter(row => row.name === 'Z b'), undefined, small);
  assert.equal(z.orbit.inclinationDegrees, Number((Math.acos(0.05) * 180 / Math.PI).toFixed(3)));
  assert.match(z.orbit.sources.shape!, /inclination derived from its impact parameter 0.5 with its a\/R\* 10 \(Winn 2010, eq. 7\)/u);
  assert.throws(() => assembleArchiveOrbit(rows.filter(row => row.name === 'W b'), undefined, small), /impact parameter 12 with a\/R\* 10 allows none/u);
  // The period and transit time come from one row, the one that predicts 2026 best: HAT-P-11 b's default row (4.888 d, 2009) drifts
  // 5.3 hours by 2024; a newer row with a precise period does not. Its 22 empty columns are the row's own, then pl_orbpererr1, pl_tranmiderr1.
  const hat = parseArchiveRows([header,
    `"HAT-P-11 b",${anchor('BAKOS_ET_AL__2010', '2010ApJ...710.1724B', 'Bakos et al. 2010')},1,4.888,15.58,88.5,0,,2454957.8132,0.422,0.081,,0.75,0.81,0,,,,,,,0.001,0.0002`,
    `"HAT-P-11 b",${anchor('HUBER_ET_AL__2017', '2017AJ....153..181H', 'Huber et al. 2017')},0,4.887802443,16.0,89.0,0,,2454605.89146,,,,,,0,,,,,,,0.000000034,0.00003`].join('\n'));
  const timed = assembleArchiveOrbit(hat, undefined, { value: 0.081, provenance: 'Mass', limit: false, label: 'Bakos et al. 2010' });
  assert.deepEqual([timed.orbit.periodDays, timed.orbit.transitTimeBmjdTdb], [4.887802443, Number((2454605.89146 - 2400000.5).toFixed(6))], 'the precise newer ephemeris');
  assert.equal(timed.orbit.semiMajorAxisStellarRadii, 15.58, 'the shape stays the default row\'s');
  assert.match(timed.orbit.sources.phase!, /Huber et al\. 2017.*predicts 2026-01-01 best \(1 sigma 1 min\)/u);
  // Kepler's law in solar units: the Earth's year around the Sun is 215 solar radii (it was 766 times too large before 2026-09-24).
  const { keplerRatio } = await import('./orbit.mts');
  assert.equal(Number(keplerRatio(1, 365.25, 1).toFixed(1)), 215.0);
  // Neither an inclination nor an impact parameter: the duration and depth give it. K2-148 b's second row: T 1.776 h, Rp/R* 0.0173,
  // a/R* 16.4, P 4.38 d; the geometry gives b = a/R* cos i, checked against the same equation solved for T.
  const timedRows = parseArchiveRows([header, `"T b",${anchor('H_ET_AL__2018', '2018AJ....155..136H', 'Hirano et al. 2018')},1,4.38395,,,0,,2457000.5,0.15,,,0.6,0.6,0,,,`,
    `"T b",${anchor('D_ET_AL__2018', '2018AJ....156...22D', 'Dressing et al. 2018')},0,4.38395,16.4,,,,,,,,,,0,,1.776,0.0173`].join('\n'));
  const timedOrbit = assembleArchiveOrbit(timedRows, undefined, small).orbit, ci = Math.cos(timedOrbit.inclinationDegrees * Math.PI / 180);
  const back = 24 * 4.38395 / Math.PI * Math.asin(Math.sqrt((1.0173 ** 2 - (16.4 * ci) ** 2)) / (16.4 * Math.sin(timedOrbit.inclinationDegrees * Math.PI / 180)));
  assert.ok(Math.abs(back - 1.776) < 1e-3, `the derived inclination gives back the duration: ${back}`);
  assert.match(timedOrbit.sources.shape!, /inclination derived from its transit duration 1\.776 h and Rp\/R\* 0\.0173 with its a\/R\* 16\.4 \(Winn 2010, eqs\. 14 and 16\)/u);
  // The chosen paper's own numbers come before another paper's a/R*: Kepler-1651 b's default row (Mann et al. 2017) gives its star, a
  // KOI table gives an a/R* half as large; the orbit is the default paper's.
  const koi = parseArchiveRows([header, `"K b",${anchor('MANN_ET_AL__2017', '2017AJ....153..267M', 'Mann et al. 2017')},1,9.87863917,,89.9,0,,2455000.5,0.2,,,0.503,0.522,0,`,
    `"K b",${anchor('Q1_Q16_KOI_TABLE', '2014ApJS..210...19B', 'Q1-Q16 KOI Table')},0,9.87863917,14.04,,,,,,,,,,0,`].join('\n'));
  const own = assembleArchiveOrbit(koi, undefined, small).orbit;
  assert.equal(own.semiMajorAxisStellarRadii, Number(keplerRatio(0.522, 9.87863917, 0.503).toFixed(4)));
  assert.match(own.sources.shape!, /Mann et al\. 2017.*a\/R\* derived by Kepler's third law/u);
  // A stated a/R* that Kepler's law with the same star cannot give is refused: ZTF J1828+2308 b's 0.838 is its orbit in solar radii.
  const wd = parseArchiveRows([header, `"ZTF b",${anchor('P_ET_AL__2025', '2025MNRAS.1...1P', 'Parsons et al. 2025')},1,0.1120067,0.838,88.9,0,,2460000.5,0.993,,,0.0131,0.61,0,`].join('\n'));
  assert.throws(() => assembleArchiveOrbit(wd, undefined, small), /Parsons et al\. 2025's a\/R\* 0\.838 disagrees with Kepler's third law \(63\.3[0-9] from P 0\.1120067 d, .* by a factor of 75\.[0-9], beyond 2/u);
  // A flagged upper limit is not a mass: the archive's calculated value serves, or the planet is refused.
  const y = rows.filter(row => row.name === 'Y b');
  assert.equal(y[0]!.massJupiter, undefined); assert.equal(y[0]!.massLimitJupiter, 0.05);
  assert.match(assembleArchiveOrbit(y, undefined, { value: 0.002, provenance: 'M-R relationship', limit: false, label: 'Calculated Value' }).mass.row.label, /calculated value/u);
  // A radial-velocity minimum mass is a paper's measurement, cited to the paper, not the archive's model.
  const minimum = assembleArchiveOrbit(y, undefined, { value: 0.02, provenance: 'Msini', limit: false, label: 'Bonomo et al. 2023', url: 'https://arxiv.org/abs/2304.05773' }).mass.row;
  assert.deepEqual([minimum.label, minimum.url], ["Bonomo et al. 2023, the minimum mass (M sin i) the NASA Exoplanet Archive's composite table adopts", 'https://arxiv.org/abs/2304.05773']);
  // An adopted upper limit stays a limit, and the density rule does not judge it (Kepler-62's five planets were refused before).
  const limited = assembleArchiveOrbit(y, undefined, { value: 0.5, provenance: 'Mass', limit: true, label: 'C et al. 2022' }).mass;
  assert.deepEqual([limited.value, limited.limit, limited.row.label], [0.5, true, 'C et al. 2022']);
  // A mass that makes an impossible density is refused before the records see it.
  assert.throws(() => assembleArchiveOrbit(y, undefined, { value: 0.1, provenance: 'Mass', limit: false, label: 'D et al. 2023' }), /g\/cm\^3, outside what the records accept/u);
});

test('reader quotes come verbatim from the Wikipedia lead: the sentence naming the body, then the next; no article, a disambiguation page or an article about something else gives none', async () => {
  const { pickQuotes, sentences, wikipediaLead, wikipediaQuotes } = await import('./prose.mts');
  const extract = 'HD 219134 is a main-sequence star in the constellation Cassiopeia. It is 6.5 parsecs (21 light-years) from the Sun. Smith et al. (2015) found HD 219134 b, a rocky planet with a 3.09-day orbit, transiting the star.';
  assert.equal(sentences(extract).length, 3);
  assert.deepEqual(pickQuotes(extract, ['HD 219134 b']), { card: 'Smith et al. (2015) found HD 219134 b, a rocky planet with a 3.09-day orbit, transiting the star.' });
  assert.deepEqual(pickQuotes(extract, ['HD 219134']), { card: 'HD 219134 is a main-sequence star in the constellation Cassiopeia.', introduction: 'It is 6.5 parsecs (21 light-years) from the Sun.' });
  const pages: Record<string, unknown> = {
    'HD_219134': { type: 'standard', title: 'HD 219134', extract, description: 'Star in the constellation Cassiopeia', revision: 1234, content_urls: { desktop: { page: 'https://en.wikipedia.org/wiki/HD_219134' } } },
    'Mercury': { type: 'disambiguation', title: 'Mercury', extract: 'Mercury may refer to:', revision: 1, content_urls: { desktop: { page: 'https://en.wikipedia.org/wiki/Mercury' } } },
    'HD_219134_c': { type: 'standard', title: 'HD 219134', extract, description: 'Star in the constellation Cassiopeia', revision: 1234, content_urls: { desktop: { page: 'https://en.wikipedia.org/wiki/HD_219134' } } },
    'HD_219134_e': { type: 'standard', title: 'HD 219134e', extract: 'HD 219134e is a planet orbiting HD 219134. It takes 94 days.', description: 'Exoplanet', revision: 7, content_urls: { desktop: { page: 'https://en.wikipedia.org/wiki/HD_219134e' } } },
    'HD_219134_f': { type: 'standard', title: 'Kepler space telescope', extract: 'Kepler was a space telescope that found many a planet. It retired in 2018.', description: 'Space telescope', revision: 8, content_urls: { desktop: { page: 'https://en.wikipedia.org/wiki/Kepler_space_telescope' } } },
    'GJ_436_b': { type: 'standard', title: 'Gliese 436 b', extract: 'Gliese 436 b is a Neptune-sized exoplanet orbiting the red dwarf Gliese 436. It was the first hot Neptune discovered with certainty.', description: 'Exoplanet', revision: 9, content_urls: { desktop: { page: 'https://en.wikipedia.org/wiki/Gliese_436_b' } } },
    'GJ_436': { type: 'standard', title: 'Gliese 436', extract: 'Gliese 436 is a red dwarf in Leo. In 2004, the existence of an extrasolar planet, Gliese 436 b, was verified as orbiting the star.', description: 'Star in the constellation Leo', revision: 10, content_urls: { desktop: { page: 'https://en.wikipedia.org/wiki/Gliese_436' } } },
    'Ariel': { type: 'standard', title: 'Ariel', extract: 'Ariel is a spirit in The Tempest.', description: 'Character in a play', revision: 2, content_urls: { desktop: { page: 'https://en.wikipedia.org/wiki/Ariel' } } },
  };
  const archive = { exists: async (url: string) => decodeURIComponent(url.split('/').at(-1)!) in pages, text: async (url: string) => JSON.stringify(pages[decodeURIComponent(url.split('/').at(-1)!)]), bytes: async () => Buffer.alloc(0) };
  assert.equal(await wikipediaLead(archive, 'HD 219134 d'), undefined, 'no article');
  assert.equal(await wikipediaLead(archive, 'Mercury'), undefined, 'disambiguation');
  assert.equal(await wikipediaLead(archive, 'Ariel'), undefined, 'not a star or planet');
  assert.deepEqual(await wikipediaQuotes(archive, ['HD 219134 b', 'HD 219134'], ['HD 219134 b']), { url: 'https://en.wikipedia.org/wiki/HD_219134', title: 'HD 219134', revision: '1234',
    card: 'Smith et al. (2015) found HD 219134 b, a rocky planet with a 3.09-day orbit, transiting the star.' }, "a planet without its own article quotes its host's lead where it is named");
  assert.equal(await wikipediaQuotes(archive, ['HD 219134 c', 'HD 219134'], ['HD 219134 c']), undefined, "a planet name redirecting to a host lead that never names the planet gives it no quote");
  assert.equal((await wikipediaQuotes(archive, ['HD 219134 e', 'HD 219134'], ['HD 219134 e']))?.card, 'HD 219134e is a planet orbiting HD 219134.', 'a redirect to the planet\'s own article, titled with its letter joined');
  assert.equal(await wikipediaQuotes(archive, ['HD 219134 f', 'HD 219134'], ['HD 219134 f']), undefined, 'a redirect to an article about something else, which never names the planet');
  assert.equal((await wikipediaQuotes(archive, ['GJ 436 b', 'GJ 436'], ['GJ 436 b']))?.card, 'Gliese 436 b is a Neptune-sized exoplanet orbiting the red dwarf Gliese 436.', 'GJ and Gliese are one catalogue: the planet\'s own article, served under Gliese');
  assert.equal((await wikipediaQuotes(archive, ['GJ 436', 'GJ 436'], ['GJ 436']))?.card, 'Gliese 436 is a red dwarf in Leo.', 'the host\'s own article, served under Gliese');
  const { spelledOut } = await import('./prose.mts');
  assert.deepEqual(['55 Cnc e', 'eps Ind A', 'HU Aqr', 'ups And b', 'mu2 Sco', 'HD 219134 b', 'Kepler-62 f', 'TOI-700'].map(spelledOut),
    ['55 Cancri e', 'Epsilon Indi A', 'HU Aquarii', 'Upsilon Andromedae b', 'Mu2 Scorpii', 'HD 219134 b', 'Kepler-62 f', 'TOI-700'], 'as Wikipedia titles the articles');
});

test('a planet takes its color from what is measured: the emission row with the smallest relative uncertainty, else its host\'s light on the gray', async () => {
  const { EMISSION_COLUMNS, parseEmissionRows, pickThermalRow } = await import('./planet-datasets.mts');
  const { hostLitGray } = await import('@cssearth/bake/objects/color');
  const csv = [EMISSION_COLUMNS,
    'WASP-39 b,0.8,0.4,,,,,,,,,TESS,,"<a refstr=X href=https://ui.adsabs.harvard.edu/abs/2021AJ....162..127W/abstract target=ref>Wong et al. 2021</a>"',
    'WASP-39 b,3.6,0.75,220,40,-40,0,1050,50,-50,0,Spitzer,IRAC,"<a refstr=Y href=https://ui.adsabs.harvard.edu/abs/2018AJ....155...29K/abstract target=ref>Kammer et al. 2018</a>"',
    'WASP-39 b,4.5,1.0,300,45,-45,0,1100,80,-80,0,Spitzer,IRAC,"<a refstr=Y href=https://ui.adsabs.harvard.edu/abs/2018AJ....155...29K/abstract target=ref>Kammer et al. 2018</a>"',
    'WASP-39 b,15,3,900,100,-100,0,1500,60,-60,1,JWST,MIRI,"<a refstr=Z href=https://ui.adsabs.harvard.edu/abs/2099ApJ...1...1A/abstract target=ref>Anyone 2099</a>"'].join('\n');
  const rows = parseEmissionRows(csv);
  assert.equal(rows.length, 4);
  assert.deepEqual([rows[0]!.temperatureK, rows[1]!.temperatureErrorK, rows[3]!.temperatureLimit, rows[1]!.label, rows[1]!.url], [undefined, 50, true, 'Kammer et al. 2018', 'https://ui.adsabs.harvard.edu/abs/2018AJ....155...29K/abstract']);
  const picked = pickThermalRow(rows)!;
  assert.deepEqual([picked.wavelengthMicrometres, picked.temperatureK], [3.6, 1050], 'the 3.6 µm row: 50/1050 beats 80/1100; the 15 µm limit is never a value');
  assert.equal(pickThermalRow([rows[0]!, rows[3]!]), undefined);
  assert.deepEqual(hostLitGray('#808080'), [128, 128, 128], 'a gray host leaves the gray');
  const red = hostLitGray('#ff8040');
  assert.ok(red[0] > red[1] && red[1] > red[2], 'an orange host makes the gray orange');
  const luminance = (rgb: readonly number[]) => 0.2126 * ((rgb[0]! / 255) ** 2.2) + 0.7152 * ((rgb[1]! / 255) ** 2.2) + 0.0722 * ((rgb[2]! / 255) ** 2.2);
  assert.ok(Math.abs(luminance(red) - luminance([128, 128, 128])) < 0.01, 'at the gray\'s brightness');
});

test('band photometry in a spec is checked by the dataset\'s own parser: three bands red to blue on a shared range from zero', async () => {
  const { parsePhotometryEntries } = await import('./spec.mts');
  const photometry = { unit: 'µJy', source: { citation: 'Carter et al. (2023), ApJL 951, L20', url: 'https://arxiv.org/abs/2208.14990', locator: 'Table 3, HIP 65426 b' },
    bands: [{ band: 'F444W', wavelengthMicrometres: 4.4, value: 300, error: 20 }, { band: 'F356W', wavelengthMicrometres: 3.56, value: 250, error: 15 }, { band: 'F300M', wavelengthMicrometres: 3.0, value: 120, error: 10 }],
    displayRange: [0, 300], displayRangeSource: 'One range for this planet alone, to its brightest band.' };
  const entries = parsePhotometryEntries([{ id: 'hip-65426-b', photometry }]);
  assert.deepEqual(entries.get('hip-65426-b')!.bands.map(band => band.band), ['F444W', 'F356W', 'F300M']);
  assert.throws(() => parsePhotometryEntries([{ id: 'x', photometry: { ...photometry, bands: [photometry.bands[2], photometry.bands[1], photometry.bands[0]] } }]), /red, green, blue/);
  assert.throws(() => parsePhotometryEntries([{ id: 'x', photometry: { ...photometry, displayRange: [0, 200] } }]), /above the common range/);
  assert.throws(() => parsePhotometryEntries([{ id: 'x', photometry }, { id: 'x', photometry }]), /listed twice/);
});

test('a generated planet with a measured dayside temperature keeps its thermal dataset text; the shape-only text is only for a shape planet', async () => {
  const { hostedPackage } = await import('./hosted.mts');
  const { EMISSION_COLUMNS } = await import('./planet-datasets.mts');
  const emission = [EMISSION_COLUMNS, 'HD 219134 b,4.5,1.0,300,45,-45,0,1400,80,-80,0,Spitzer,IRAC,"<a refstr=Y href=https://ui.adsabs.harvard.edu/abs/2018AJ....155...29K/abstract target=ref>Kammer et al. 2018</a>"'].join('\n');
  // The Charts tab's archive spectra (planet-charts.mts): three measured transmission bins and a limit that is left out; no emission bins.
  const { spectrumColumns } = await import('./planet-charts.mts'), cite = '"<a refstr=A href=https://arxiv.org/abs/2110.06729 target=ref>A et al. 2022</a>"';
  const transit = [spectrumColumns('transmission'), `0.60,0.20,1.20,0.02,-0.03,0,Kepler,CCD,${cite}`, `1.40,0.20,1.25,0.02,-0.02,0,HST,WFC3,${cite}`, `4.50,1.00,1.31,0.04,-0.04,0,Spitzer,IRAC,${cite}`, `3.60,0.70,1.50,,,1,Spitzer,IRAC,${cite}`].join('\n');
  const archive: Archive = { async text(url) { const query = decodeURIComponent(new URL(url).searchParams.get('query') ?? '');
    if (query.includes('from transitspec')) return transit;
    if (query.startsWith('select tic_id,pl_trandur')) return 'tic_id,pl_trandur\n';
    if (query.includes('from emissionspec')) return query.startsWith('select plntname') ? emission : `${spectrumColumns('emission')}\n`;
    throw new Error(`unexpected ${url}`); }, async bytes() { throw new Error('none'); }, async exists() { return false; } };
  const paper = { id: 'arxiv-2110-06729', title: 'A paper', creators: ['A Author'], year: '2022', url: star.paper.url, arxiv: '2110.06729' };
  const host = { id: 'hd-219134', physical: { name: 'HD 219134', meanRadiusKm: 695700, gravitationalParameterKm3PerS2: 132712440041.9, parent: null }, star: { distanceParsecs: 10, rightAscensionDegrees: 0, declinationDegrees: 0, positionEpochJulianYear: 2016, properMotionRaMasPerYear: 0, properMotionDecMasPerYear: 0, radialVelocityKmPerS: 0 } };
  const orbit = { periodDays: 3, semiMajorAxisStellarRadii: 9, inclinationDegrees: 88, eccentricity: 0, transitTimeBmjdTdb: 59000, ascendingNodePositionAngleDegrees: 0, sources: { period: 'p', shape: 's', eccentricity: 'e', phase: 'ph', orientation: 'o' } };
  const cited = { value: 1, source: 's', url: star.paper.url };
  const thermal = { temperatureK: 1400, uncertaintyK: 80, wavelengthMicrometres: 4.5, facility: 'Spitzer IRAC', source: 'Kammer et al. 2018, dayside brightness temperature at 4.5 µm', url: 'https://ui.adsabs.harvard.edu/abs/2018AJ....155...29K/abstract', chosen: '1 measured of 1 rows' };
  const build = async (extra: Record<string, unknown>, mass: typeof cited & { limit?: true; unmeasured?: true } = cited, radius: typeof cited = cited) => {
    const spec = parseStarSpec({ ...star, planets: [{ id: 'hd-219134b', name: 'HD 219134 b', description: 'A planet.', text: { card: 'A planet.', introduction: 'A planet made from fixtures.', locator: 'fixture' }, paper: star.paper, radius: cited, mass: cited, orbit: { elements: { periodDays: 3, semiMajorAxisStellarRadii: 9, inclinationDegrees: 88, eccentricity: 0, transitTimeBmjdTdb: 59000 }, source: 's', url: star.paper.url }, ...extra }] }).planets[0]!;
    const body = { id: spec.id, classification: 'exoplanet', order: 2, physical: { name: spec.name, horizonsCode: null, meanRadiusKm: 71492, gravitationalParameterKm3PerS2: 126686531.9, parent: 'hd-219134' }, physicalNotes: 'n', hostedOrbit: orbit };
    const record = { spec, hostId: 'hd-219134', system: 'HD 219134 system', body, order: 2, orbit, orbitCitation: { text: 's', url: star.paper.url, label: 's' }, radius, mass, documents: new Map<string, string>(), todo: [] };
    const { files } = await hostedPackage(record, host, new Map([[star.paper.url, paper]]), archive, root, 2460000);
    const text = JSON.parse(String(files.get('src/objects/hd-219134b/text.json'))), content = JSON.parse(String(files.get('src/objects/hd-219134b/source/content/object.json')));
    assertWholePackage(files, 'hd-219134b', true);
    const charts = JSON.parse(String(files.get('src/objects/hd-219134b/source/content/charts.json'))) as { charts: Record<string, any>[] };
    return { datasets: Object.keys(text.datasets), notes: String(content.datasets.controls[0].notes), dataset: String(content.datasets.controls[0].id), facts: content.panel.facts as { id: string; value: string }[],
      charts: charts.charts, chartControls: content.charts as { id: string; titleKey: string }[], readme: String(files.get('src/objects/hd-219134b/README.md')),
      spectrum: JSON.parse(String(files.get('src/objects/hd-219134b/source/science/archive-spectra/transmission.json') ?? 'null')) as { measurements: { y: number; minus: number; plus: number }[] } | null };
  };
  const glow = await build({ thermal });
  // Its Charts tab: the system's orbits, and the transmission bins of the one paper, as published; the limit is left out.
  assert.deepEqual(glow.chartControls.map(chart => [chart.id, chart.titleKey]), [['hd-219134b-orbits', 'systemOrbits'], ['hd-219134b-transmission', 'transmissionSpectrum']]);
  assert.deepEqual(glow.charts.map(chart => chart.kind), ['system-orbits', 'measured-spectrum']);
  assert.deepEqual(glow.spectrum!.measurements.map(bin => [bin.y, bin.minus, bin.plus]), [[1.2, 0.03, 0.02], [1.25, 0.02, 0.02], [1.31, 0.04, 0.04]]);
  const axis = glow.charts[1]!.y as { minimum: number; maximum: number };
  assert.ok(axis.minimum <= 1.17 && axis.maximum >= 1.35, 'the axis holds every bar and its error');
  assert.match(glow.readme, /\*\*Charts\.\*\* The orbits of HD 219134's planets from above, from their hosted-orbit records, and its transmission spectrum, 3 bins from A et al\. 2022/u);
  assert.deepEqual([glow.dataset, glow.datasets], ['thermal', ['thermal']]);
  assert.match(glow.notes, /black body at the dayside brightness temperature/u);
  const shape = await build({});
  assert.deepEqual([shape.dataset, shape.datasets], ['shape', ['shape']]);
  assert.match(shape.notes, /the gray marks an unresolved surface/u);
  // Host light adds its sentence to the base note; the scaffold's TODO never survives (a regression #691 introduced).
  assert.doesNotMatch(shape.notes, /TODO/u);
  assert.match(shape.notes, /takes the color of hd-219134's light/u);
  // A mass that is only an upper limit is shown as one.
  assert.equal((await build({}, { ...cited, value: 0.12, limit: true })).facts.find(fact => fact.id === 'mass')!.value, 'Under 0.12 Jupiter masses');
  assert.equal((await build({}, { ...cited, value: 0, unmeasured: true })).facts.find(fact => fact.id === 'mass')!.value, 'Not measured');
  assert.equal((await build({}, { ...cited, value: 0.3, source: "the NASA Exoplanet Archive's calculated value (M-R relationship): a model, not a measurement" })).facts.find(fact => fact.id === 'mass')!.value, '0.30 Jupiter masses (model)', 'two figures kept as printed');
  // A planet under 0.3 Jupiter radii reads its radius and mass in Earth units alike (HD 3167 c: 0.266 and 0.036 Jupiter).
  const small = (await build({}, { ...cited, value: 0.036 }, { ...cited, value: 0.2661 })).facts;
  assert.deepEqual(['radius', 'mass'].map(id => small.find(fact => fact.id === id)!.value), ['3.0 Earth radii', '11 Earth masses']);
});

test('a planet whose archive mass is only an upper limit gets GM 0, the records\' unpublished value, and the limit in its notes', async () => {
  const { hostedRecord } = await import('./hosted.mts');
  const anchor = '"<a refstr=BORUCKI_ET_AL__2013 href=https://ui.adsabs.harvard.edu/abs/2013Sci...340..587B/abstract target=ref>Borucki et al. 2013</a>"';
  const ps = ['pl_name,pl_refname,default_flag,pl_orbper,pl_ratdor,pl_orbincl,pl_orbeccen,pl_orblper,pl_tranmid,pl_radj,pl_bmassj,pl_orbsmax,st_rad,st_mass,pl_bmassjlim,pl_imppar,pl_trandur,pl_ratror,pl_orbtper,pl_orbinclerr1,pl_bmassprov,pl_orbpererr1,pl_tranmiderr1',
    `"Kepler-62 f",${anchor},1,267.291,,89.9,0,,2454967.3,0.126,0.11,0.718,0.64,0.69,1,`].join('\n');
  const composite = `pl_name,pl_bmassj,pl_bmassjlim,pl_bmassprov,pl_bmassj_reflink\n"Kepler-62 f",0.11,1,Mass,${anchor}`;
  const archive: Archive = { async text(url) { const query = decodeURIComponent(new URL(url).searchParams.get('query') ?? ''); if (query.includes('from pscomppars')) return composite; if (query.includes('from ps where pl_name')) return ps; throw new Error(`unexpected ${url}`); }, async bytes() { throw new Error('none'); }, async exists() { return false; } };
  const spec = parseStarSpec({ ...star, planets: [{ id: 'kepler-62f', name: 'Kepler-62 f', description: 'A planet.', text: { card: 'A planet.', introduction: 'A planet made from fixtures.', locator: 'fixture' }, paper: star.paper, orbit: { archive: 'nasa-ps' } }] });
  const host = { spec, body: { physical: { meanRadiusKm: 0.64 * 695700 }, star: { distanceParsecs: 300 } } };
  const record = await hostedRecord(spec.planets[0]!, host, 2, archive, root);
  assert.equal((record.body.physical as { gravitationalParameterKm3PerS2: number }).gravitationalParameterKm3PerS2, 0);
  assert.match(String(record.body.physicalNotes), /No mass is measured: Borucki et al\. 2013 \(2013Sci\.\.\.340\.\.587B\), via the NASA Exoplanet Archive \(https:[^)]+\) gives only an upper limit of 0\.11 Jupiter masses/u);
  // No mass at all in the composite table: GM 0 as well, and the notes say the mass is not measured.
  const none = await hostedRecord(spec.planets[0]!, host, 2, { ...archive, async text(url) { return url.includes('pscomppars') ? 'pl_name,pl_bmassj,pl_bmassjlim,pl_bmassprov,pl_bmassj_reflink\n' : archive.text(url); } }, root);
  assert.deepEqual([(none.body.physical as { gravitationalParameterKm3PerS2: number }).gravitationalParameterKm3PerS2, none.mass.unmeasured], [0, true]);
  assert.match(String(none.body.physicalNotes), /No mass is measured: the NASA Exoplanet Archive's composite table, which adopts no mass for Kepler-62 f/u);
});

test('a Planck color outside sRGB (a cool companion) is shown desaturated and the record says so; one inside keeps its record plain', async () => {
  const { planckChoice } = await import('./color.mts');
  const cmf = parseCieTable((await readCie1931ColorMatching()).toString('utf8'), 3);
  const cool = planckChoice('x', { value: 1300, source: 's', url: star.paper.url }, 'why', [], cmf);
  assert.equal((cool.record as { gamut?: string }).gamut, 'desaturate');
  assert.ok(cool.color.gamut && cool.color.gamut.whiteFraction > 0);
  const warm = planckChoice('x', { value: 5800, source: 's', url: star.paper.url }, 'why', [], cmf);
  assert.equal((warm.record as { gamut?: string }).gamut, undefined);
  assert.equal(warm.color.gamut, undefined);
});

test('the archive draft of a host keeps only its confirmed transiting planets, sorted by period, with the archive temperature where one is measured', async () => {
  const { archiveSpec } = await import('./from-archive.mts');
  const ref = (label: string, bib: string) => `"<a refstr=${label.toUpperCase().replace(/[^A-Z]+/gu, '_')} href=https://ui.adsabs.harvard.edu/abs/${bib}/abstract target=ref>${label}</a>"`;
  const stars = ['pl_name,hostname,default_flag,pl_refname,st_refname,st_rad,st_raderr1,st_teff,st_tefferr1,st_mass,st_masserr1,sy_dist,disc_year,discoverymethod,tran_flag,pl_letter,hd_name,hip_name,gaia_dr3_id,cb_flag,sy_snum,disc_facility,sy_pnum',
    `HD 1 c,HD 1,1,${ref('Two et al. 2020', '2020AJ....1....2T')},${ref('Two et al. 2020', '2020AJ....1....2T')},0.8,0.02,5000,50,0.85,0.03,20.5,2020,Transit,1,c,HD 1,,Gaia DR3 123456789,0,1,K2,3`,
    `HD 1 b,HD 1,1,${ref('One et al. 2019', '2019AJ....1....1O')},${ref('One et al. 2019', '2019AJ....1....1O')},0.8,0.02,5000,50,0.85,0.03,20.5,2019,Transit,1,b,HD 1,,Gaia DR3 123456789,0,1,K2,3`,
    `HD 1 d,HD 1,1,${ref('Three et al. 2021', '2021AJ....1....3T')},${ref('Three et al. 2021', '2021AJ....1....3T')},0.8,,5000,,0.85,,20.5,2021,Radial Velocity,0,d,HD 1,,Gaia DR3 123456789,0,1,K2,3`].join('\n');
  // GJ 436's case: the default row leaves the stellar temperature empty and another paper's row gives it.
  const gapped = stars.replaceAll(',5000,50,', ',,,').replace(',5000,,', ',,,') + `\nHD 1 b,HD 1,0,${ref('Four et al. 2022', '2022AJ....1....4F')},${ref('Four et al. 2022', '2022AJ....1....4F')},0.81,,5010,40,0.86,,20.5,2019,Transit,1,b,HD 1,,Gaia DR3 123456789,0,1,K2,3`;
  const ps = ['pl_name,pl_refname,default_flag,pl_orbper,pl_ratdor,pl_orbincl,pl_orbeccen,pl_orblper,pl_tranmid,pl_radj,pl_bmassj,pl_orbsmax,st_rad,st_mass,pl_bmassjlim,pl_imppar,pl_trandur,pl_ratror,pl_orbtper,pl_orbinclerr1,pl_bmassprov,pl_orbpererr1,pl_tranmiderr1',
    `"HD 1 c",${ref('Two et al. 2020', '2020AJ....1....2T')},1,10.0,20.0,89.0,0,,2459000.5,0.2,0.02,,0.8,0.85,0`,
    `"HD 1 b",${ref('One et al. 2019', '2019AJ....1....1O')},1,3.0,9.0,88.0,0,,2458000.5,0.1,0.01,,0.8,0.85,0`].join('\n');
  const composite = (name: string, mass: number) => `pl_name,pl_bmassj,pl_bmassjlim,pl_bmassprov,pl_bmassj_reflink\n"${name}",${mass},0,Mass,${ref('One et al. 2019', '2019AJ....1....1O')}`;
  const { EMISSION_COLUMNS } = await import('./planet-datasets.mts');
  const emission = (name: string) => name === 'HD 1 b' ? `${EMISSION_COLUMNS}\nHD 1 b,4.5,1.0,300,45,-45,0,1400,80,-80,0,Spitzer,IRAC,${ref('Four et al. 2022', '2022AJ....1....4F')}` : `${EMISSION_COLUMNS}\n`;
  const archive: Archive = {
    async text(url) {
      const query = decodeURIComponent(new URL(url).searchParams.get('query') ?? '');
      if (query.includes('from ps where hostname')) return query.includes('st_teff') ? stars : ps;
      if (query.includes('from pscomppars')) return composite(/pl_name = '([^']+)'/u.exec(query)![1]!, 0.003);
      if (query.includes('from emissionspec')) return emission(/plntname='([^']+)'/u.exec(query)![1]!);
      throw new Error(`unexpected ${url}`);
    }, async bytes() { throw new Error('none'); }, async exists() { return false; } };
  const { spec, skipped, notes } = await archiveSpec(archive, 'HD 1', { ids: new Set(), names: new Map(), stars: [] });
  const planets = spec.planets as { id: string; thermal?: unknown; text: { card: string; introduction: string; locator: string } }[];
  assert.deepEqual(planets.map(planet => planet.id), ['hd-1b', 'hd-1c'], 'innermost first, whatever the archive order');
  assert.deepEqual([planets[0]!.thermal !== undefined, planets[1]!.thermal !== undefined], [true, false]);
  assert.match(skipped.join('; '), /HD 1 d: found by radial velocity, and the archive gives no orbit rows for it/u);
  assert.match(notes.join('; '), /HD 1 c: no measured dayside brightness temperature/u);
  // WASP-8 b's dayside, 938 K (archive, 2026-09-29), is too cool for a black-body color: it takes its host's light, and says why.
  const cool = { ...archive, async text(url: string) { return (await archive.text(url)).replace(',1400,80,-80,', ',938,40,-40,'); } };
  const cooled = await archiveSpec(cool, 'HD 1', { ids: new Set(), names: new Map(), stars: [] });
  assert.equal((cooled.spec.planets as { thermal?: unknown }[])[0]!.thermal, undefined);
  assert.match(cooled.notes.join('; '), /HD 1 b: its dayside brightness temperature, 938 K \(Four et al\. 2022\), is too cool to glow \(a black-body color needs over 1000 K\); its gray takes the host's light/u);
  assert.equal((spec.temperature as { value: number }).value, 5000);
  assert.equal(spec.gaia, '123456789', 'the archive\'s Gaia DR3 id, which SIMBAD must agree with');
  // A host the universe holds under another id, found by the name its planets use: its new planets become an addition to it.
  const held = await archiveSpec(archive, 'HD 1', { ids: new Set(['hd-1b-host']), names: new Map([['hd1', 'hd-1b-host']]), stars: [{ id: 'hd-1b-host', ra: 1, dec: 1, epoch: 2016, pmra: 0, pmdec: 0 }] });
  assert.equal(held.spec.host, 'hd-1b-host');
  assert.deepEqual((held.spec.planets as { id: string }[]).map(planet => planet.id), ['hd-1b-host-b', 'hd-1b-host-c']);
  // The text says what the factsheet cannot: how and when each planet was found, how many its star has, and the star's planets.
  const text = planets[0]!.text as { card: string; introduction: string; locator: string };
  assert.equal(text.card, 'HD 1 b was found in 2019 by K2 as it crossed its star.');
  assert.match(text.introduction, /^It is one of 3 planets known around HD 1\. Its orbit and size follow One et al\. 2019's fit, the archive's default\.$/u);
  assert.match(text.locator, /disc_year 2019, disc_facility K2, sy_pnum 3/u);
  assert.equal((spec.text as { card: string }).card, '2 planets cross HD 1 as seen from Earth: b, c.');
  assert.equal((spec.text as { introduction: string }).introduction, 'Its radius and temperature follow One et al. 2019.');
  const filled = await archiveSpec({ ...archive, async text(url) { const query = decodeURIComponent(new URL(url).searchParams.get('query') ?? ''); return query.includes('st_teff') ? gapped : archive.text(url); } }, 'HD 1', { ids: new Set(), names: new Map(), stars: [] });
  const temperature = filled.spec.temperature as { value: number; uncertainty: number; source: string };
  assert.deepEqual([temperature.value, temperature.uncertainty], [5010, 40], 'from the other row, with its own uncertainty');
  assert.match(temperature.source, /Four et al\. 2022.*the default leaves it empty/u);
  assert.equal((filled.spec.radius as { value: number }).value, 0.8, 'the default row still gives the radius');
  // A confirmed planet the archive still lists by its catalogue number is named by its host and the archive's letter.
  const numbered = { ...archive, async text(url: string) { const query = decodeURIComponent(new URL(url).searchParams.get('query') ?? ''); const answer = await archive.text(url.replaceAll('HD+1.01', 'HD+1+c').replaceAll('HD%201.01', 'HD%201%20c')); return query.includes('from ps where hostname') ? answer.replaceAll('HD 1 c,', 'HD 1.01,').replaceAll('"HD 1 c"', '"HD 1.01"') : answer; } };
  const listed = await archiveSpec(numbered, 'HD 1', { ids: new Set(), names: new Map(), stars: [] });
  const c = (listed.spec.planets as { id: string; name: string; orbit: { planetName?: string } }[]).find(planet => planet.id === 'hd-1c')!;
  assert.deepEqual([c.name, c.orbit.planetName], ['HD 1 c', 'HD 1.01']);
  assert.match(listed.notes.join('; '), /HD 1 c: listed in the NASA Exoplanet Archive as HD 1\.01; named by its host and the archive's letter c/u);
  // A host the universe names otherwise is found by the Gaia DR3 source its position cites.
  const byGaia = await archiveSpec(archive, 'HD 1', { ids: new Set(['hd-one']), names: new Map(), stars: [], gaia: new Map([['123456789', 'hd-one']]) });
  assert.equal(byGaia.spec.host, 'hd-one');
  // A host with no planet to add is left out, with the reasons, not drafted as a lone star.
  const rvOnly = { ...archive, async text(url: string) { const query = decodeURIComponent(new URL(url).searchParams.get('query') ?? ''); return query.includes('st_teff') ? stars.split('\n').filter(line => !line.startsWith('HD 1 b') && !line.startsWith('HD 1 c')).join('\n') : archive.text(url); } };
  await assert.rejects(archiveSpec(rvOnly, 'HD 1', { ids: new Set(), names: new Map(), stars: [] }), /^Error: HD 1: no planet to add; HD 1 d: found by radial velocity, and the archive gives no orbit rows for it\.$/u);
  // No archive row gives a temperature: TIC v8.2's for the same Gaia source, cited to it.
  const noTeff = stars.replaceAll(',5000,50,', ',,,').replace(',5000,,', ',,,');
  const tic = ['#', 'TIC\tTeff\ts_Teff\tRad\ts_Rad\tMass\ts_Mass', '\t\t\t\t\t\t', '---\t---\t---\t---\t---\t---\t---', '42\t4800\t120\t0.79\t0.04\t0.84\t0.1'].join('\n');
  const ticArchive = { ...archive, async text(url: string) { if (url.includes('asu-tsv')) return new URL(url).searchParams.get('GAIA') === '123456789' ? tic : ''; const query = decodeURIComponent(new URL(url).searchParams.get('query') ?? ''); return query.includes('st_teff') ? noTeff : archive.text(url); } };
  const fromTic = (await archiveSpec(ticArchive, 'HD 1', { ids: new Set(), names: new Map(), stars: [] })).spec;
  assert.deepEqual([(fromTic.temperature as { value: number }).value, (fromTic.temperature as { uncertainty: number }).uncertainty], [4800, 120]);
  assert.match((fromTic.temperature as { source: string }).source, /TIC 42 \(VizieR IV\/39\/tic82\); no NASA Exoplanet Archive row gives one/u);
  assert.equal((fromTic.text as { introduction: string }).introduction, 'Its radius follows One et al. 2019, and its temperature the TESS Input Catalog v8.2.');
  const noGaia = { ...ticArchive, async text(url: string) { return url.includes('asu-tsv') ? '' : ticArchive.text(url); } };
  await assert.rejects(archiveSpec(noGaia, 'HD 1', { ids: new Set(), names: new Map(), stars: [] }), /no archive row gives a stellar temperature, nor does TIC v8.2 for Gaia DR3 123456789/u);
  // A companion's planet: TOI-2267 d orbits TOI-2267 B (archive, 2026-09-29). The planet TOI-2267 b is not its host, nor is the
  // placed primary its name prefix finds; B is drafted as its own star in the primary's system.
  const companionHost = stars.replaceAll(',HD 1,1,', ',HD 1 B,1,');
  const companion = { ...archive, async text(url: string) { const query = decodeURIComponent(new URL(url).searchParams.get('query') ?? ''); return query.includes('st_teff') ? companionHost : archive.text(url); } };
  const pair = { ids: new Set(['hd-1', 'hd-1b']), names: new Map([['hd1', 'hd-1'], ['hd1b', 'hd-1b']]), stars: [{ id: 'hd-1', ra: 1, dec: 1, epoch: 2016, pmra: 0, pmdec: 0 }] };
  const b = (await archiveSpec(companion, 'HD 1 B', pair)).spec as { id: string; host?: string; system: string };
  assert.deepEqual([b.id, b.host, b.system], ['hd-1-b', undefined, 'HD 1 system']);
  // No archive row gives a mass: Gaia DR3 FLAME's when it has one, else TIC v8.2's (the Lafarga et al. 2026 TIC hosts, 2026-09-29).
  const noMass = stars.replaceAll(',0.85,0.03,', ',,,').replace(',0.85,,', ',,,');
  const gaiaRow = (mass: string) => `source_id,ref_epoch,ra,dec,parallax,parallax_error,pmra,pmdec,radial_velocity,radial_velocity_error,ruwe,phot_g_mean_mag,bp_rp,has_xp_sampled,mass_flame,mass_flame_lower,mass_flame_upper,radius_flame,radius_flame_lower,radius_flame_upper\n123456789,2016.0,10,20,50,0.02,1,1,,,1.0,9.0,1.0,true,${mass},0.79,0.8,0.8,0.78,0.82`;
  const massArchive = (mass: string) => ({ ...ticArchive, async text(url: string) { if (url.includes('tap-server')) return gaiaRow(mass); if (url.includes('asu-tsv')) return tic; const query = decodeURIComponent(new URL(url).searchParams.get('query') ?? ''); return query.includes('st_teff') ? noMass : archive.text(url); } });
  assert.equal((await archiveSpec(massArchive('0.8'), 'HD 1', { ids: new Set(), names: new Map(), stars: [] })).spec.mass, 'gaia-flame');
  const ticMass = (await archiveSpec(massArchive(''), 'HD 1', { ids: new Set(), names: new Map(), stars: [] })).spec.mass as { value: number; uncertainty: number; source: string };
  assert.deepEqual([ticMass.value, ticMass.uncertainty], [0.84, 0.1]);
  assert.match(ticMass.source, /TIC 42 \(VizieR IV\/39\/tic82\); no NASA Exoplanet Archive row gives one, nor does Gaia DR3 FLAME$/u);
  // The draft chooses the planets by what was measured: HD 1 b has its dayside temperature; HD 1 c, with no spectrum or TESS transit,
  // is left out and named; a host left with nothing measured is not drafted at all.
  const asked: string[] = [], evidence = async (planet: string) => { asked.push(planet); return 'TESS holds no 2-minute SPOC light curve of TIC 42'; };
  const chosen = await archiveSpec(archive, 'HD 1', { ids: new Set(), names: new Map(), stars: [] }, evidence);
  assert.deepEqual([(chosen.spec.planets as { id: string }[]).map(planet => planet.id), asked], [['hd-1b'], ['HD 1 c']], 'a planet with a dayside temperature is not asked again');
  assert.match(chosen.skipped.join('; '), /HD 1 c: nothing measured to show \(no dayside temperature or archive spectrum; TESS holds no 2-minute SPOC light curve of TIC 42\)/u);
  const unmeasured = { ...archive, async text(url: string) { return url.includes('emissionspec') ? (await archive.text(url)).split('\n')[0]! + '\n' : archive.text(url); } };
  await assert.rejects(archiveSpec(unmeasured, 'HD 1', { ids: new Set(), names: new Map(), stars: [] }, evidence), /HD 1: no planet to add; .*HD 1 b: nothing measured to show/u);
});

test('ids follow one rule, and a body the universe holds is found whatever its id', async () => {
  const { hostId, planetId, planetPrefix, duplicateName, duplicateStar, existingBodies } = await import('./identity.mts');
  assert.equal(hostId({ planetPrefix: planetPrefix('pi Men c', 'c'), hostname: 'HD 39091' }), 'pi-men', 'the name its planets use');
  assert.equal(hostId({ hostname: '55 Cnc', hd: 'HD 75732' }), 'hd-75732', 'a name starting with a digit falls to its HD name');
  assert.equal(hostId({ hostname: 'Kepler-444' }), 'kepler-444');
  assert.deepEqual([hostId({ hostname: 'K2-32B' }), hostId({ hostname: 'HD 1 B' }), hostId({ hostname: 'Kepler-16AB' })], ['k2-32-b', 'hd-1-b', 'kepler-16ab'], 'a component letter against its number is hyphenated, never read as a planet');
  assert.throws(() => hostId({ hostname: '2MASS J0249' }), /starts with a letter/u);
  assert.deepEqual([planetId('hd-219134', 'b'), planetId('trappist-1', 'e'), planetId('pi-men', 'c'), planetId('kepler-16ab', 'b')], ['hd-219134b', 'trappist-1e', 'pi-men-c', 'kepler-16ab-b']);
  assert.throws(() => planetId('hd-1', '01'), /not one letter/u);
  const universe = await existingBodies(root);
  assert.equal(duplicateName(universe, 'TRAPPIST-1 e'), 'trappist-1e', 'spaces, case and punctuation ignored');
  const trappist = JSON.parse(await readFile(resolve(root, 'packages/astronomy/data/bodies/trappist-1.json'), 'utf8')).star;
  assert.equal(duplicateStar(universe, { ra: trappist.rightAscensionDegrees + 1 / 3600, dec: trappist.declinationDegrees, epoch: 2016 }), 'trappist-1', 'one arcsecond away is the same star');
  assert.equal(duplicateStar(universe, { ra: trappist.rightAscensionDegrees, dec: trappist.declinationDegrees, epoch: 2016 }, 'trappist-1'), undefined, 'a refresh does not find itself');
  assert.equal(duplicateStar(universe, { ra: trappist.rightAscensionDegrees + 0.1, dec: trappist.declinationDegrees, epoch: 2016 }), undefined);
});

test('a refresh regenerates what the tool wrote and keeps what a person wrote', async () => {
  const { mkdtemp, mkdir, writeFile, rm } = await import('node:fs/promises'), { tmpdir } = await import('node:os');
  const { mergeRefresh, refreshSpec, STORED_SPEC, storedHostedSpec } = await import('./refresh.mts');
  const drafted = 'X b crosses its star every 3 days. The introduction is generated from A et al.\'s published values; the sections below are the data\'s own.';
  const readme = (opening: string, extra = '') => `# X b\n\n## Sources\n\n${opening}\n\n**Orbit.** P 3 d.\n\n## Evidence\n\nGenerated 2026-09-24 by new-object.\n${extra}\n## Known problems\n\n- **Drafted text.** The card was drafted.\n\n[Investigation ledger](investigations.json) · [Credits](NOTICE.md)\n`;
  const regenerated = readme(drafted.replace('3 days', '3.1 days')).replace('P 3 d', 'P 3.1 d');
  const dir = await mkdtemp(resolve(tmpdir(), 'cssearth-refresh-'));
  try {
    const o = resolve(dir, 'src/objects/x-b'), put = async (path: string, value: unknown) => { await mkdir(resolve(o, path, '..'), { recursive: true }); await writeFile(resolve(o, path), typeof value === 'string' ? value : JSON.stringify(value)); };
    const spec = { kind: 'planet' as const, id: 'x-b', name: 'X b', description: 'd', paper: { url: 'https://arxiv.org/abs/2110.06729', credit: 'A' }, orbit: { archive: 'nasa-ps' as const }, text: { card: 'X b crosses its star every 3 days.', introduction: drafted.split(' This account')[0]!, locator: 'row' } };
    await put(STORED_SPEC, storedHostedSpec(spec, 'x', 7));
    await put('source/content/object.json', { datasets: { controls: [{ id: 'shape' }] } });
    await put('source/manifest.json', { inputs: [{ path: 'photometry/old.csv' }], documents: [] });
    await put('text.json', { card: { text: 'A person\'s card.' }, introduction: { text: spec.text.introduction } });
    await put('README.md', readme(drafted)); await put('investigations.json', { entries: ['a person\'s'] });
    const files = new Map<string, string>([['src/objects/x-b/source/content/object.json', JSON.stringify({ datasets: { controls: [{ id: 'shape' }] } })],
      ['src/objects/x-b/source/manifest.json', JSON.stringify({ inputs: [], documents: [] })], ['src/objects/x-b/text.json', JSON.stringify({ card: { text: 'new card' }, introduction: { text: 'new introduction' } })],
      ['src/objects/x-b/README.md', regenerated], ['src/objects/x-b/investigations.json', '{}']]);
    const { kept, stale } = await mergeRefresh(files, 'x-b', dir);
    const text = JSON.parse(files.get('src/objects/x-b/text.json')!);
    assert.deepEqual([text.card.text, text.introduction.text], ['A person\'s card.', 'new introduction'], 'the edited card stays; the drafted introduction is regenerated');
    assert.deepEqual([kept, stale], [['text.json card', 'investigations.json'], ['src/objects/x-b/source/photometry/old.csv']]);
    assert.equal(files.get('src/objects/x-b/README.md'), regenerated, 'the drafted README is regenerated');
    await put('README.md', '# X b\n\n## Sources\n\nA person\'s account.\n');
    const again = new Map(files); again.set('src/objects/x-b/README.md', regenerated);
    assert.ok((await mergeRefresh(again, 'x-b', dir)).kept.includes('README.md (a person wrote it; check its numbers)'));
    assert.equal(again.has('src/objects/x-b/README.md'), false, "a person's README is not written over");
    assert.equal(files.has('src/objects/x-b/investigations.json'), false, 'the ledger is not written over');
    assert.deepEqual(await refreshSpec(dir, ['x-b']), { stars: [{ host: 'x', planets: [{ ...(({ kind, ...rest }) => rest)(spec), order: 7 }], companions: [] }] });
    // A person's dataset is never dropped.
    await put('source/content/object.json', { datasets: { controls: [{ id: 'shape' }, { id: 'radial-field-2017' }] } });
    await assert.rejects(mergeRefresh(files, 'x-b', dir), /datasets the tool does not make \(radial-field-2017\)/u);
    await assert.rejects(refreshSpec(dir, ['hand-made']), /not made by new-object/u);
  } finally { await rm(dir, { recursive: true, force: true }); }
});

test('a wide companion is drafted as a placed star bound to its host from the three catalogues; a circumbinary host is refused', async () => {
  const { wideCompanions } = await import('./companions.mts');
  const { archiveSpec } = await import('./from-archive.mts');
  const asu = (header: string, row: string) => `#\n# VizieR\n${header}\n${header.split('\t').map(() => ' ').join('\t')}\n${header.split('\t').map(() => '---').join('\t')}\n${row}\n`;
  const archive: Archive = { async text(url, form) {
    if (form?.QUERY?.includes('FROM basic')) return 'main_id\n"HD 233731B"';
    const query = new URL(url).searchParams;
    if (query.get('-source') === 'J/MNRAS/506/2269/catalog') return query.get('Source1') ? asu('Source1\tSource2\tsepAU\tR', '846946621395854848\t846946625690867328\t747.3\t0.001') : asu('Source1\tSource2\tsepAU\tR', '');
    if (query.get('-source') === 'IV/39/tic82') return asu('TIC\tTeff\ts_Teff\tRad\ts_Rad\tMass\ts_Mass', '252479261\t3589.0\t157.0\t0.599\t0.018\t0.587\t0.02');
    throw new Error(`unexpected ${url}`);
  }, async bytes() { throw new Error('none'); }, async exists() { return false; } };
  const { companions, notes } = await wideCompanions(archive, { id: 'hat-p-22', gaia: '846946621395854848', name: 'HAT-P-22', system: 'HAT-P-22 system' }, () => undefined);
  assert.deepEqual(notes, []);
  const star = companions[0]! as { id: string; name: string; system: string; gaia: string; boundTo: { host: string; source: string }; temperature: { value: number; uncertainty: number; source: string }; radius: { value: number }; mass: { value: number }; text: { card: string } };
  assert.deepEqual([star.id, star.name, star.system, star.gaia, star.temperature.value, star.temperature.uncertainty, star.radius.value, star.mass.value], ['hd-233731-b', 'HD 233731B', 'HAT-P-22 system', '846946625690867328', 3589, 157, 0.599, 0.587]);
  assert.match(star.temperature.source, /TIC 252479261/u);
  // The bond is data: the star it is bound to and the catalogue row that says so, which puts it inside that star's system.
  assert.equal(star.boundTo.host, 'hat-p-22');
  assert.match(star.boundTo.source, /El-Badry, Rix & Heintz \(2021, MNRAS 506, 2269\) list HAT-P-22 and HD 233731B .* source_id 846946621395854848 and 846946625690867328\), 747 AU apart on the sky, with a chance-alignment probability of 1\.0e-3: the pair is bound/u);
  assert.deepEqual(parseStarSpec(star).boundTo, star.boundTo);
  assert.doesNotThrow(() => parseStarSpec(star), 'the draft is a valid star spec');
  const held = await wideCompanions(archive, { id: 'hat-p-22', gaia: '846946621395854848', name: 'HAT-P-22', system: 's' }, () => 'hd-233731-b');
  assert.deepEqual([held.companions.length, /already in the universe as hd-233731-b/u.test(held.notes[0]!)], [0, true]);
  // A circumbinary host: the pair's orbit is a paper's, so the draft refuses it.
  const cb = { async text(url: string) { if (decodeURIComponent(url).includes('st_teff')) return 'pl_name,hostname,default_flag,pl_refname,st_refname,st_rad,st_raderr1,st_teff,st_tefferr1,st_mass,st_masserr1,sy_dist,disc_year,discoverymethod,tran_flag,pl_letter,hd_name,hip_name,gaia_dr3_id,cb_flag,sy_snum,disc_facility,sy_pnum\nTOI-1338 b,TOI-1338,1,x,x,1,,5990,,1,,400,2020,Transit,1,b,,,Gaia DR3 1,1,2,TESS,2'; return ''; }, async bytes() { throw new Error('none'); }, async exists() { return false; } };
  await assert.rejects(archiveSpec(cb, 'TOI-1338', { ids: new Set(), names: new Map(), stars: [] }), /circumbinary/u);
});

test('a hosted body\'s package is written after phase one wrote its astronomy record (a regression #695 introduced)', async () => {
  const { mkdtemp, mkdir, writeFile, readFile: read, rm } = await import('node:fs/promises'), { tmpdir } = await import('node:os');
  const { writePackageFiles } = await import('./generate.mts');
  const dir = await mkdtemp(resolve(tmpdir(), 'cssearth-write-'));
  try {
    await mkdir(resolve(dir, 'packages/astronomy/data/bodies'), { recursive: true }); await mkdir(resolve(dir, 'src/sources'), { recursive: true });
    await writeFile(resolve(dir, 'packages/astronomy/data/bodies/x-b.json'), '{}');
    const { written } = await writePackageFiles(new Map([['src/objects/x-b/README.md', '# X b\n']]), 'x-b', dir);
    assert.deepEqual(written, ['src/objects/x-b/README.md']);
    assert.equal(await read(resolve(dir, 'src/objects/x-b/README.md'), 'utf8'), '# X b\n');
    await assert.rejects(writePackageFiles(new Map([['src/objects/x-b/README.md', 'again']]), 'x-b', dir), /never overwrites a package/u, 'an existing package still is');
  } finally { await rm(dir, { recursive: true, force: true }); }
});

test('a paper cited by every star of a batch is read from its archive once; a failed read is asked again', async () => {
  const { fetchPublication } = await import('./archives/archives.mts');
  let asked = 0, fail = true;
  const archive = { async text() { asked++; if (fail) { fail = false; throw new Error('arXiv answered 503'); } return '<feed><entry><id>http://arxiv.org/abs/2304.00037v2</id><title>A paper</title><published>2023-03-31T00:00:00Z</published><author><name>L. Breuval</name></author></entry></feed>'; } } as unknown as Archive;
  await assert.rejects(fetchPublication(archive, 'https://arxiv.org/abs/2304.00037'), /503/u);
  const [first, second] = await Promise.all([fetchPublication(archive, 'https://arxiv.org/abs/2304.00037'), fetchPublication(archive, 'https://arxiv.org/abs/2304.00037')]);
  assert.equal(asked, 2, 'one failed read, then one read shared by both stars');
  assert.equal(first, second);
});

test('a DOI Crossref does not hold is read from DataCite, as the CDS VizieR catalogues are', async () => {
  const { fetchPublication } = await import('./archives/archives.mts');
  const datacite = JSON.stringify({ data: { attributes: { titles: [{ title: 'Gaia DR2' }], publicationYear: 2018, publisher: 'Centre de Donnees Strasbourg (CDS)', creators: [{ name: 'European Space Agency' }] } } });
  const archive: Archive = { async text(url) { if (url.includes('api.crossref.org')) throw new Error(`${url} answered 404 Not Found.`); if (url.includes('api.datacite.org')) return datacite; throw new Error(`unexpected ${url}`); },
    async bytes() { throw new Error('none'); }, async exists() { return false; } };
  const found = (await fetchPublication(archive, 'https://doi.org/10.26093/cds/vizier.1345'))!;
  assert.deepEqual([found.id, found.title, found.year, found.publisher, found.creators], ['doi-10-26093-cds-vizier-1345', 'Gaia DR2', '2018', 'Centre de Donnees Strasbourg (CDS)', ['European Space Agency']]);
  // Any other Crossref failure is not a missing DOI, and is reported as it is.
  const down: Archive = { ...archive, async text(url) { throw new Error(`${url} answered 503 Service Unavailable.`); } };
  await assert.rejects(fetchPublication(down, 'https://doi.org/10.26093/cds/vizier.1345'), /503/u);
});

test('a reference the archive cites only by its ADS bibcode is read as the paper it links to, keeping the bibcode', async () => {
  const { fetchPublication } = await import('./archives/archives.mts');
  const { publicationRecord } = await import('./generate.mts');
  const arxiv = '<feed><entry><title>Seven temperate terrestrial planets</title><published>2017-03-04T00:00:00Z</published><author><name>Michael Gillon</name></author><author><name>Amaury Triaud</name></author><author><name>Brice-Olivier Demory</name></author><arxiv:journal_ref>Nature 542, 456</arxiv:journal_ref></entry></feed>';
  const crossref = JSON.stringify({ message: { title: ['Seven temperate terrestrial planets'], issued: { 'date-parts': [[2017]] }, author: [{ given: 'Michael', family: 'Gillon' }, { given: 'Amaury', family: 'Triaud' }, { given: 'Brice-Olivier', family: 'Demory' }], 'container-title': ['Nature &amp; Astronomy'], volume: '1', 'article-number': '0056' } });
  const linked: Archive = { async text(url) { if (url.includes('api.crossref.org')) return crossref; if (url.includes('export.arxiv.org')) return arxiv; throw new Error(`unexpected ${url}`); }, async bytes() { throw new Error('none'); }, async exists() { return false; },
    async location(url) { return url.endsWith('/EPRINT_HTML') ? 'https://arxiv.org/abs/1703.01430' : url.endsWith('/PUB_HTML') ? 'https://doi.org/10.1038/s41550-017-0056' : undefined; } };
  const found = (await fetchPublication(linked, 'https://ui.adsabs.harvard.edu/abs/2017NatAs...1E..56G/abstract'))!;
  assert.deepEqual([found.id, found.arxiv, found.doi, found.bibcode, found.creators.length, found.publisher], ['doi-10-1038-s41550-017-0056', '1703.01430', '10.1038/s41550-017-0056', '2017NatAs...1E..56G', 3, 'Nature & Astronomy 1 0056'], 'the published paper, its preprint id kept, entities decoded');
  const record = publicationRecord(found);
  assert.match(String(record.title), /^Gillon et al\. \(2017\): Seven temperate/u);
  const preprint = (await fetchPublication({ ...linked, async location(url) { return url.endsWith('/EPRINT_HTML') ? 'https://arxiv.org/abs/1703.01430' : undefined; } }, 'https://ui.adsabs.harvard.edu/abs/2017NatAs...1E..56G/abstract'))!;
  assert.equal(preprint.id, 'arxiv-1703-01430', 'no DOI: the arXiv record');
  assert.deepEqual(record.identifiers.map((identifier: { type: string }) => identifier.type), ['arXiv', 'DOI', 'bibliography-key']);
  // A DOI record without authors (a correction, as 2024MNRAS.533..109G is): the linked preprint's authors.
  const authorless = (await fetchPublication({ ...linked, async text(url) { return url.includes('api.crossref.org') ? crossref.replace(/"author":\[[^\]]*\],/u, '') : linked.text(url); } }, 'https://ui.adsabs.harvard.edu/abs/2017NatAs...1E..56G/abstract'))!;
  assert.deepEqual([authorless.id, authorless.creators.length], ['doi-10-1038-s41550-017-0056', 3]);
  // No gateway answer: the bibcode record as before.
  const alone = (await fetchPublication({ ...linked, async location() { return undefined; } }, 'https://ui.adsabs.harvard.edu/abs/2017NatAs...1E..56G/abstract'))!;
  assert.equal(alone.id, 'publication-2017natas-1e-56g');
});

/** What the bake will ask of any package the generator writes: every file the manifest declares exists (the marker is drawn after
 * writing), every file under source/ is declared, every input is bound, and a drafted package carries no TODO. */
function assertWholePackage(files: ReadonlyMap<string, string | Buffer>, id: string, drafted: boolean) {
  const o = `src/objects/${id}`, manifest = JSON.parse(String(files.get(`${o}/source/manifest.json`)));
  const declared = [...manifest.inputs, ...manifest.documents, ...manifest.generatedIntermediates ?? []].map((entry: { path: string }) => entry.path);
  for (const path of declared) if (path !== 'presentation/context.png') assert.ok(files.has(`${o}/source/${path}`), `${id}: the manifest declares ${path}, which the package does not hold`);
  for (const path of files.keys()) if (path.startsWith(`${o}/source/`) && !path.endsWith('manifest.json')) assert.ok(declared.includes(path.slice(`${o}/source/`.length)), `${id}: ${path} is not declared in the manifest`);
  for (const input of manifest.inputs) assert.ok(input.sourceBinding, `${id}: input ${input.id} has no source binding`);
  if (drafted) for (const [path, value] of files) if (path.startsWith(o) && typeof value === 'string') assert.doesNotMatch(value, /TODO\(new-object\)/u, `${id}: ${path} keeps a TODO`);
}

test('a whole star package from fixtures is what the bake accepts: declared files, bound inputs, no TODO, a stored spec that reads back', async () => {
  const { generateStar } = await import('./generate.mts');
  const { STORED_SPEC } = await import('./refresh.mts');
  const gaia = '2009481748875806976';
  const row = ['source_id,ref_epoch,ra,dec,parallax,parallax_error,pmra,pmdec,radial_velocity,radial_velocity_error,ruwe,phot_g_mean_mag,bp_rp,has_xp_sampled,mass_flame,mass_flame_lower,mass_flame_upper,radius_flame,radius_flame_lower,radius_flame_upper',
    `${gaia},2016.0,348.3,57.17,153.08,0.02,2074.4,294.9,-18.5,0.2,1.0,5.2,0.99,false,0.8,0.78,0.82,0.78,0.77,0.79`].join('\n');
  const arxiv = '<feed><entry><title>A paper</title><published>2022-01-01T00:00:00Z</published><author><name>A Author</name></author></entry></feed>';
  const archive: Archive = {
    async text(url) { if (url.includes('gea.esac.esa.int/tap')) return row; if (url.includes('export.arxiv.org')) return arxiv; if (url.includes('asu-tsv')) return '#\n'; throw new Error(`unexpected ${url}`); },
    async bytes(url) { if (url.includes('III/126')) return gzipSync(''); return Buffer.from(''); }, async exists() { return false; } };
  const unplaced = parseStarSpec({ ...star, id: 'test-fixture-star', name: 'Test Fixture Star', gaia, target: undefined, limb: { none: 'a test fixture' },
    text: { card: 'A test star.', introduction: 'A test star made from fixtures.', locator: 'fixture' } });
  const options = { archive, root, order: 9999, universe: { ids: new Set<string>(), names: new Map<string, string>(), stars: [] }, solarEpoch: await loadSolarEpoch(root),
    resolver: async () => ({ mainId: 'Test Fixture Star', identifiers: [`Gaia DR3 ${gaia}`] }) };
  // A new package names the object it is inside, or the star it is bound to: the tree has no place for it otherwise.
  await assert.rejects(generateStar(unplaced, options), /test-fixture-star: a new object names the object it is inside/u);
  const spec = parseStarSpec({ ...unplaced, planets: [], companions: [], parent: 'milky-way' });
  const generated = await generateStar(spec, options);
  assert.equal(JSON.parse(String(generated.files.get(`src/objects/${spec.id}/object.json`))).parent, 'milky-way');
  const bond = { host: 'hat-p-3', source: 'A catalogue lists the pair as bound.' };
  const bound = await generateStar(parseStarSpec({ ...unplaced, planets: [], companions: [], boundTo: bond }), options);
  assert.equal(JSON.parse(String(bound.files.get(`src/objects/${spec.id}/object.json`))).parent, 'hat-p-3-system', 'a bound star is inside its star\'s system');
  const record = JSON.parse(String(bound.files.get(`packages/astronomy/data/bodies/${spec.id}.json`))).star;
  assert.deepEqual([record.boundTo, record.sources.binary], [bond.host, bond.source]);
  assert.equal(generated.color.route, 'planck', 'no archive spectrum in the fixtures, so the Planck route');
  assertWholePackage(generated.files, spec.id, true);
  const { parseInvestigationLedger } = await import('@cssearth/bake/sources');
  const ledger = parseInvestigationLedger(JSON.parse(String(generated.files.get(`src/objects/${spec.id}/investigations.json`))), spec.id);
  assert.deepEqual(ledger.entries.map(entry => entry.id), ['placement', 'radius-mass-and-temperature', 'color'], 'the ledger records each choice the generator made');
  const stored = parseObjectSpecs({ stars: [JSON.parse(String(generated.files.get(`src/objects/${spec.id}/${STORED_SPEC}`)))] }).stars[0]!;
  assert.deepEqual(stored, { ...spec, order: 9999 }, 'the stored spec reads back to the spec that made the package');
});

test('a star beyond Gaia\'s parallax is placed at its cited distance; a weak or missing parallax without one is refused', async () => {
  const { generateStar, placement, PARALLAX_FLOOR_SIGMA } = await import('./generate.mts'), { parseGaiaRow } = await import('./archives/archives.mts');
  const gaia = '303374445376245632', header = 'source_id,ref_epoch,ra,dec,parallax,parallax_error,pmra,pmdec,radial_velocity,radial_velocity_error,ruwe,phot_g_mean_mag,bp_rp,has_xp_sampled,mass_flame,mass_flame_lower,mass_flame_upper,radius_flame,radius_flame_lower,radius_flame_upper';
  // A two-parameter solution: a position and a magnitude, as Gaia DR3 gives a star in another galaxy.
  const twoParameter = [header, `${gaia},2016.0,23.4424,30.7444,,,,,,,,19.2,-0.1,false,,,,,,`].join('\n');
  const row = parseGaiaRow(twoParameter, gaia);
  assert.equal(row.parallax, undefined); assert.equal(row.pmra, undefined); assert.equal(row.ruwe, undefined);
  assert.throws(() => parseGaiaRow([header, `${gaia},2016.0,23.4,30.7,0.1,,1,1,,,1.0,19.2,-0.1,false,,,,,,`].join('\n'), gaia), /parallax_error empty while parallax, pmra, pmdec, ruwe are given/u);
  const base = { ...star, id: 'test-far-star', name: 'Test Far Star', gaia, target: undefined, radius: { value: 12, source: 'a paper', url: star.paper.url }, mass: { value: 33, source: 'a paper', url: star.paper.url },
    temperature: { value: 37000, source: 'a paper', url: star.paper.url }, radialVelocity: { value: -180, source: 'a paper', url: star.paper.url } };
  assert.throws(() => placement(parseStarSpec(base), row), /has no parallax \(a two-parameter solution\); give distance with its source/u);
  const distance = { value: 964000, uncertainty: 54000, source: 'Bonanos et al. (2006), ApJ 652, 313', url: star.paper.url };
  const far = parseStarSpec({ ...base, distance });
  const placed = placement(far, row);
  assert.equal(placed.parsecs, 964000);
  assert.match(placed.source, /Bonanos et al\. \(2006\).*964000 \+\/- 54000 pc; Gaia DR3 gives this source no parallax/u);
  assert.deepEqual([placed.properMotion.ra, placed.properMotion.dec], [0, 0]);
  assert.match(placed.properMotion.source, /two-parameter solution with no proper motion; zero is assumed \(at 964,000 pc, 1 mas\/yr would be 4,570 km\/s/u);
  // A parallax under the floor places nothing by itself; a cited distance replaces it and says so.
  const weak = { ...row, parallax: 0.4, parallaxError: 0.1, pmra: 1, pmdec: 2, ruwe: 1 } as GaiaRow;
  assert.throws(() => placement(parseStarSpec(base), weak), new RegExp(`is 4\\.0 standard errors, under the ${PARALLAX_FLOOR_SIGMA} that places a star`, 'u'));
  assert.match(placement(far, weak).source, /Gaia DR3 parallax 0\.4000 \+\/- 0\.1000 mas \(same row, RUWE 1\.00\), 4\.0 standard errors, is not used/u);
  assert.equal(placement(parseStarSpec(base), { ...weak, parallax: 2, parallaxError: 0.1 }).parsecs, 500);
  // The whole package: the record, the distance fact and the README all name the cited distance.
  const arxiv = '<feed><entry><title>A paper</title><published>2006-01-01T00:00:00Z</published><author><name>A Bonanos</name></author></entry></feed>';
  const archive: Archive = {
    async text(url) { if (url.includes('gea.esac.esa.int/tap')) return twoParameter; if (url.includes('export.arxiv.org')) return arxiv; if (url.includes('asu-tsv')) return '#\n'; throw new Error(`unexpected ${url}`); },
    async bytes(url) { if (url.includes('III/126')) return gzipSync(''); return Buffer.from(''); }, async exists() { return false; } };
  const spec = parseStarSpec({ ...base, distance, parent: 'm33', limb: { none: 'a test fixture' }, text: { card: 'A far star.', introduction: 'A star in another galaxy made from fixtures.', locator: 'fixture' } });
  const generated = await generateStar(spec, { archive, root, order: 9998, universe: { ids: new Set(), names: new Map(), stars: [] }, solarEpoch: await loadSolarEpoch(root),
    resolver: async () => ({ mainId: 'Test Far Star', identifiers: [`Gaia DR3 ${gaia}`] }) });
  assertWholePackage(generated.files, spec.id, true);
  const body = JSON.parse(String(generated.files.get(`packages/astronomy/data/bodies/${spec.id}.json`)));
  assert.equal(body.star.distanceParsecs, 964000);
  const facts = JSON.parse(String(generated.files.get(`src/objects/${spec.id}/source/content/object.json`))).panel.facts;
  assert.deepEqual(facts.find((fact: { id: string }) => fact.id === 'distance').value, '964,000 parsecs');
  assert.equal(facts.find((fact: { id: string }) => fact.id === 'distance').source.label, distance.source);
  assert.match(String(generated.files.get(`src/objects/${spec.id}/README.md`)), /distance 964,000 pc from Bonanos et al\. \(2006\), ApJ 652, 313; Gaia DR3 gives it no parallax/u);
});

test('an imaged planet\'s K, H and J magnitudes become the band color, each cited to its paper; a band the MKO columns lack comes from 2MASS, and a planet missing a band in both is named', async () => {
  const { draftUltracoolPhotometry, readCsv, ULTRACOOL } = await import('./archives/ultracool.mts');
  const { parsePhotometryEntries } = await import('./spec.mts');
  assert.deepEqual(readCsv('a,b\n"x, y",2\n'), [{ a: 'x, y', b: '2' }]);
  const main = 'name,name_simbad,name_simbadable,J_MKO,Jerr_MKO,ref_J_MKO,H_MKO,Herr_MKO,ref_H_MKO,K_MKO,Kerr_MKO,ref_K_MKO,J_2MASS,Jerr_2MASS,ref_J_2MASS,H_2MASS,Herr_2MASS,ref_H_2MASS,Ks_2MASS,Kserr_2MASS,ref_Ks_2MASS\n51 Eri b,* 51 Eri b,* 51 Eri b,19.04,0.40,Raja17,18.99,0.21,Raja17,18.67,0.19,Raja17,NaN,NaN,null,NaN,NaN,null,NaN,NaN,null\nAF Lep b,null,null,19.22,0.1,X,18.61,0.1,X,NaN,NaN,null,NaN,NaN,null,NaN,NaN,null,16.75,0.07,DeRo23\nVHS J125601.92-125723.9 b,null,null,17.136,0.02,X,15.777,0.02,X,14.55,0.02,X,NaN,NaN,null,NaN,NaN,null,NaN,NaN,null\nGhost b,null,null,19,0.1,X,18,0.1,X,NaN,NaN,null,NaN,NaN,null,NaN,NaN,null,NaN,NaN,null\n';
  const refs = 'code_ref,ADSkey_ref,Paperskey_ref,citetext_ref,title_ref,notes_ref\nRaja17,2017AJ....154...10R,k,Rajan et al. (2017),"Characterizing 51 Eri b, 1 to 5 um",\n';
  const svo = (lambda: number, zero: number) => `<PARAM name="WavelengthEff" value="${lambda}"/><PARAM name="ZeroPoint" value="${zero}"/>`;
  const archive: Archive = { async text(url, form) {
    if (form?.QUERY?.includes("'51 Eridani b'")) return 'main_id\n"*  51 Eri b"'; if (form?.QUERY) return 'main_id\n';
    if (url === ULTRACOOL.main) return main; if (url === ULTRACOOL.references) return refs;
    if (url.includes('NSFCam.K')) return svo(21840.23, 638.185); if (url.includes('NSFCam.H')) return svo(16140.31, 1034.805); if (url.includes('NSFCam.J')) return svo(12417.04, 1544.028);
    if (url.includes('2MASS.Ks')) return svo(21590, 666.8); if (url.includes('2MASS.H')) return svo(16620, 1024); if (url.includes('2MASS.J')) return svo(12350, 1594);
    throw new Error(`unexpected ${url}`); }, async bytes() { throw new Error('none'); }, async exists() { return false; } };
  const { entries, notes } = await draftUltracoolPhotometry(archive, [{ id: 'hd-29391-b', name: '51 Eridani b' }, { id: 'af-lep-b', name: 'AF Lep b' }, { id: 'x', name: 'Nobody b' },
    { id: 'vhs-1256-1257-b', name: 'VHS 1256-1257 b', aliases: ['VHS J125601.92-125723.9 b'] }, { id: 'ghost-b', name: 'Ghost b' }]);
  const photometry = entries[0]!.photometry;
  assert.deepEqual(photometry.bands.map(band => band.band), ['MKO K', 'MKO H', 'MKO J'], 'red is the longest wavelength');
  assert.equal(photometry.bands[0]!.value, Number((638.185 * 10 ** (-0.4 * 18.67) * 1e6).toPrecision(4)), 'F = zero point x 10^(-0.4 m)');
  assert.equal(photometry.source.url, 'https://ui.adsabs.harvard.edu/abs/2017AJ....154...10R');
  assert.match(photometry.source.citation, /^Rajan et al\. \(2017\), as compiled in Best/u);
  assert.equal(photometry.displayRange[1], Math.max(...photometry.bands.map(band => band.value)));
  assert.doesNotThrow(() => parsePhotometryEntries(entries), 'the dataset\'s own parser accepts the draft');
  // AF Lep b has no MKO K: its 2MASS Ks is taken, with the 2MASS zero point, and the band says so.
  const mixed = entries.find(entry => entry.id === 'af-lep-b')!.photometry;
  assert.deepEqual(mixed.bands.map(band => band.band), ['2MASS Ks', 'MKO H', 'MKO J']);
  assert.equal(mixed.bands[0]!.value, Number((666.8 * 10 ** (-0.4 * 16.75) * 1e6).toPrecision(4)));
  assert.match(mixed.source.locator, /2MASS Ks 16\.75 \+\/- 0\.07 \(DeRo23\), MKO H 18\.61/u);
  // A planet the sheet names another way is found by an alias of its record.
  assert.deepEqual(entries.map(entry => entry.id), ['hd-29391-b', 'af-lep-b', 'vhs-1256-1257-b']);
  assert.deepEqual(notes.map(note => note.split(':')[0]), ['x', 'ghost-b']);
  assert.match(notes[1]!, /no MKO or 2MASS K magnitude for Ghost b/u);
});

test('a star Gaia gives no radial velocity takes SIMBAD\'s, cited to its paper, else zero with what that costs', async () => {
  const { fallbackRadialVelocity } = await import('./generate.mts');
  const simbad = (answer: string): Archive => ({ async text(url) { if (!url.includes('sim-tap')) throw new Error(`unexpected ${url}`); return answer; }, async bytes() { throw new Error('none'); }, async exists() { return false; } });
  const header = 'rvz_radvel,rvz_err,rvz_type,rvz_qual,rvz_bibcode';
  const found = await fallbackRadialVelocity(simbad(`${header}\n-12.3,0.4,v,A,2020AJ....160..120J`), '42', 300);
  assert.deepEqual([found.value, found.uncertainty, found.url], [-12.3, 0.4, 'https://ui.adsabs.harvard.edu/abs/2020AJ....160..120J/abstract']);
  assert.match(found.source, /SIMBAD's radial velocity for Gaia DR3 42 \(quality A\), from 2020AJ\.\.\.\.160\.\.120J; Gaia DR3 measures none/u);
  // A redshift is not a stellar radial velocity; with nothing else, zero is assumed and the note says what that costs.
  for (const answer of [`${header}\n0.01,,z,C,2019A&A...1..1X`, `${header}\n`]) {
    const zero = await fallbackRadialVelocity(simbad(answer), '42', 300);
    assert.equal(zero.value, 0);
    assert.match(zero.source, /Zero is assumed; a 30 km\/s error moves the star by one part in 100,000 of its distance per century/u);
  }
});

test('an archive answering a server error or a rate limit is asked again; a 404 is an answer', async () => {
  // Waits are counted, not waited out: the 503's real pause is five seconds.
  const waits: number[] = [], liveArchive = (await import('./archives/archives.mts')).createLiveArchive(async ms => { waits.push(ms); });
  const real = globalThis.fetch, answers = [503, 200, 404];
  let calls = 0;
  globalThis.fetch = (async () => { calls++; const status = answers.shift()!; return new Response(status === 200 ? 'rows' : 'busy', { status }); }) as typeof fetch;
  try {
    assert.equal(await liveArchive.text('https://example.invalid/tap'), 'rows');
    assert.equal(calls, 2, 'the 503 was asked again once');
    assert.deepEqual(waits, [5000], 'after the five seconds a 5xx waits');
    await assert.rejects(liveArchive.text('https://example.invalid/tap'), /answered 404/u);
    assert.equal(calls, 3, 'the 404 was not');
  } finally { globalThis.fetch = real; }
});

test('a planet found without a transit is placed only on one paper\'s whole orbit, tilt measured, and its model size says so', async () => {
  const { assembleMeasuredOrbit, parseArchiveRows: parse } = await import('./orbit.mts');
  const header = 'pl_name,pl_refname,default_flag,pl_orbper,pl_ratdor,pl_orbincl,pl_orbeccen,pl_orblper,pl_tranmid,pl_radj,pl_bmassj,pl_orbsmax,st_rad,st_mass,pl_bmassjlim,pl_imppar,pl_trandur,pl_ratror,pl_orbtper,pl_orbinclerr1,pl_bmassprov,pl_orbpererr1,pl_tranmiderr1';
  const ref = (key: string, bib: string, label: string) => `"<a refstr=${key} href=https://ui.adsabs.harvard.edu/abs/${bib}/abstract target=ref>${label}</a>"`;
  // pi Men b's case: the default paper gives no inclination; an astrometric paper fits the whole orbit and a true mass with it.
  const rows = parse([header,
    `"P b",${ref('D_ET_AL__2024', '2024A&A...1..1D', 'D et al. 2024')},1,2089.1,,,0.64,330.0,,,10.0,3.3,1.1,1.09,0,,,,2451554.0,,Msini`,
    `"P b",${ref('X_ET_AL__2020', '2020A&A...1..2X', 'X et al. 2020')},0,2088.8,,45.8,0.642,330.6,,,12.3,3.31,1.1,1.07,0,,,,2451550.5,1.1,Mass`].join('\n')).map(row => row.reference === 'X_ET_AL__2020' ? { ...row, massJupiter: 3.2 } : row);
  const calculated = { value: 1.08, model: true, label: 'Calculated Value' };
  const placed = assembleMeasuredOrbit(rows, { value: 10.0, provenance: 'Msini', limit: false, label: 'D et al. 2024' }, calculated);
  assert.deepEqual([placed.row!.label, placed.orbit.inclinationDegrees, placed.orbit.eccentricity, placed.orbit.argumentOfPeriapsisDegrees, placed.orbit.epochDefinition, placed.orbit.transitTimeBmjdTdb],
    ['X et al. 2020', 45.8, 0.642, 330.6, 'periastron', 51550]);
  assert.equal(placed.orbit.semiMajorAxisStellarRadii, Number((3.31 / (1.1 * 695700 / 149597870.7)).toFixed(4)), 'the same row\'s semi-major axis over its stellar radius');
  assert.deepEqual([placed.mass.value, placed.mass.row.label], [3.2, 'X et al. 2020, the mass the NASA Exoplanet Archive\'s composite table adopts'], 'the paper\'s own true mass goes with its inclination');
  assert.match(placed.radius.row.label, /calculated radius .*: a model, not a measurement, since P b does not transit/u);
  assert.match(placed.orbit.sources.shape!, /X et al\. 2020.*inclination 45\.8 \+1\.1 degrees, measured in the same fit/u);
  // A massive giant is dense: 12.3 Jupiter masses in 1.08 Jupiter radii is 12.1 g/cm^3, inside the giants' 20, while the same density
  // in a planet under half Jupiter's radius is refused.
  assert.equal(assembleMeasuredOrbit(rows.map(row => row.reference === 'X_ET_AL__2020' ? { ...row, massJupiter: 12.3 } : row), undefined, calculated).mass.value, 12.3);
  assert.throws(() => assembleMeasuredOrbit(rows.map(row => row.reference === 'X_ET_AL__2020' ? { ...row, massJupiter: 0.35 } : row), undefined, { ...calculated, value: 0.3 }), /g\/cm\^3, outside what the records accept/u);
  // An astrometric paper gives the semi-major axis in au and no stellar radius: the host's recorded radius converts it, so the
  // rendered orbit is the paper's 2.294 au (HD 29021 b, Li et al. 2021).
  const li = parse([header, `"R b",${ref('LI_ET_AL__2021', '2021AJ....162..266L', 'Li et al. 2021')},1,1365,,33.7,0.453,180.6,,,4.47,2.294,,0.86,0,,,,2455824.8,6.8,Mass`].join('\n'));
  const astrometric = assembleMeasuredOrbit(li, undefined, { value: 1.1, model: true, label: 'Calculated Value' }, 0.88);
  assert.equal(astrometric.orbit.semiMajorAxisStellarRadii * 0.88 * 695700 / 149597870.7, Number((2.294 / (0.88 * 695700 / 149597870.7)).toFixed(4)) * 0.88 * 695700 / 149597870.7);
  assert.ok(Math.abs(astrometric.orbit.semiMajorAxisStellarRadii * 0.88 * 695700 / 149597870.7 - 2.294) < 1e-4, 'the paper\'s size in au');
  assert.match(astrometric.orbit.sources.shape!, /over the host's recorded radius 0\.88 solar radii, so the orbit keeps the paper's size/u);
  // An inclination fixed at 90, or one with no error bar, is an assumption, not a measurement: the planet is left out.
  const fixed = parse([header, `"Q b",${ref('Y_ET_AL__2015', '2015A&A...1..3Y', 'Y et al. 2015')},1,14.65,,90,0.003,98,,,0.83,0.115,0.96,0.95,0,,,,2450000.8,0,Mass`].join('\n'));
  assert.throws(() => assembleMeasuredOrbit(fixed, undefined, calculated), /Q b: found without a transit, and no paper's row measures its whole orbit together/u);
});

test('a DEBCat row drafts both stars of an eclipsing binary, and the draft is refused until the paper\'s orbit is copied in', async () => {
  const { parseDebcat, draftFromDebcat } = await import('./archives/debcat.mts');
  // Rows in the page's own format (https://www.astro.keele.ac.uk/jkt/debcat/, 2026-09-27): a whole row, one with a value but no error,
  // and one with an empty temperature.
  const td = (html: string) => `<TD STYLE="WHITE-SPACE: NOWRAP" ALIGN="CENTER"> ${html} </TD>`;
  const row = (name: string, logT: string) => `<TR BGCOLOR="#ffffff">${td(`<A HREF="http://simbad.u-strasbg.fr/simbad/sim-id?Ident=${name}">${name}</A>`)}${td('4.271')}${td('13.71 <BR> -0.18')}${td('O7.5_V <BR> O7.5_V')}`
    + `${td('19.62 &plusmn; 0.19 <BR> 19.05 &plusmn; 0.14')}${td('8.83 &plusmn; 0.08 <BR> 7.70 &plusmn; 0.05')}${td('3.839 &plusmn; 0.008 <BR> 3.945 &plusmn; 0.006')}${td(logT)}${td('<BR>')}${td('&nbsp;')}`
    + `${td('Taormina et al. (<A HREF="http://arxiv.org/abs/2604.05029">arXiv:2604.05029</A>) <BR> Taormina et al. (<A HREF="http://adsabs.harvard.edu/abs/2020ApJ...890..137T">2020ApJ...890..137T</A>)')}</TR>`;
  const rows = parseDebcat(`<TABLE>${row('OGLE-LMC-ECL-06782', '4.544 &plusmn; 0.006 <BR> 4.531 &plusmn; 0.006')}${row('AK Lac', '3.749 <BR> 3.740')}${row('TYC 459-771-1', ' <BR> ')}</TABLE>`);
  assert.deepEqual(rows.map(entry => entry.name), ['OGLE-LMC-ECL-06782', 'AK Lac', 'TYC 459-771-1']);
  assert.match('error' in rows[2]! ? rows[2].error : '', /TYC 459-771-1: log Teff "" is not a value/u);
  assert.ok('row' in rows[1]! && rows[1].row.logTeff[0][1] === undefined, 'a value without its error reads, with no error');
  assert.ok('row' in rows[0]!);
  const read = rows[0].row;
  assert.deepEqual(read.references.map(reference => reference.url), ['https://arxiv.org/abs/2604.05029', 'https://ui.adsabs.harvard.edu/abs/2020ApJ...890..137T']);
  const { spec, missing } = draftFromDebcat(read);
  assert.match(missing[0]!, /periodDays with the eclipse ephemeris it belongs to \(DEBCat's 4\.271 d is rounded\)/u);
  // The draft names what it lacks by refusing to parse; the separation is Kepler's third law: ((19.62 + 19.05) x (4.271 / 365.25)^2)^(1/3) au over 8.83 solar radii.
  assert.throws(() => parseStarSpec(spec), /periodDays/u);
  const companion = (spec.companions as Record<string, any>[])[0]!;
  assert.equal(companion.orbit.elements.semiMajorAxisStellarRadii, 4.2425);
  const filled = { ...spec, companions: [{ ...companion, orbit: { ...companion.orbit, epoch: 'superior-conjunction',
    elements: { ...companion.orbit.elements, periodDays: 4.2710, inclinationDegrees: 80, eccentricity: 0.01, argumentOfPeriapsisDegrees: 90, transitTimeBmjdTdb: 59000 } } }] };
  const parsed = parseStarSpec(filled);
  assert.equal(parsed.radius !== 'gaia-flame' && parsed.radius.value, 8.83);
  assert.equal(parsed.temperature.value, 34995);
  assert.match(parsed.temperature.source, /log Teff 4\.544 \+\/- 0\.006, as DEBCat \(Southworth 2015, ASPC 496, 164\) lists it from Taormina et al\. \(arXiv:2604\.05029\): 34995 K/u);
  assert.equal(parsed.companions[0]!.orbit && 'elements' in parsed.companions[0]!.orbit && parsed.companions[0]!.orbit.epoch, 'superior-conjunction');
});

test('a hot star beyond the ATLAS gravities takes its limb law from the TLUSTY grid, and its restore rewrites the download the same way', async () => {
  const { chooseLimb } = await import('./limb.mts');
  // The four Reeve & Howarth (2016) summary1 rows around HD 226868 (31,138 K, log g 3.348) as VizieR serves them, 2026-09-27.
  const tlusty = ['#RESOURCE=yCat_J_MNRAS_456_1294', '', 'FileName\tquad2.2\tquad2.3', ' \t \t', '--------------\t------------\t------------',
    'OG30000g325v10\t 1.31065e-01\t 3.33968e-01', 'OG30000g350v10\t 1.19605e-01\t 3.02762e-01', 'OG32500g325v10\t 1.37878e-01\t 3.47654e-01', 'OG32500g350v10\t 9.45336e-02\t 3.28943e-01', ''].join('\n');
  const archive: Archive = { async text(_url, form) { return form?.['-source'] === 'J/MNRAS/456/1294/summary1' ? tlusty : '#\n'; }, async bytes() { return Buffer.from(''); }, async exists() { return false; } };
  const limb = await chooseLimb('hd-226868', 31138, 3.348, archive);
  assert.equal(limb.grid, 'tlusty');
  assert.ok(limb.coefficients!.u1 >= 0.0945336 && limb.coefficients!.u1 <= 0.137878 && limb.coefficients!.u2 >= 0.302762 && limb.coefficients!.u2 <= 0.347654, 'inside the four nodes');
  // Every node is read: the first data row too, which the reader would take for a units line without the one the rewrite adds.
  assert.match(limb.files![0]!.text, /^logg\tTeff\ta\tb\n\[cgs\]\tK\t\t\n/mu);
  assert.match(limb.sentence, /Reeve & Howarth \(2016\), MNRAS 456, 1294 compute from non-LTE TLUSTY model atmospheres for the Bessell V band at 31,138 K and log g 3\.348/u);
  const replayed = (limb.acquisitions![0]!.replacements as { pattern: string; flags: string; replacement: string }[]).reduce((text, { pattern, flags, replacement }) => text.replace(new RegExp(pattern, flags), replacement), tlusty);
  assert.equal(replayed, limb.files![0]!.text, 'the restore recipe reproduces the stored table');
  assert.match(limb.files![0]!.text, /^logg\tTeff\ta\tb$/mu); assert.match(limb.files![0]!.text, /^3\.25\t30000\t 1\.31065e-01\t 3\.33968e-01$/mu);
  // A star ATLAS reaches keeps its ATLAS law: the new grid only fills the gap.
  assert.equal((await chooseLimb('cool', 5800, 4.4, { ...archive, async text(_url, form) { return form?.['-source'] === 'J/A+A/529/A75/table-af' ? ['logg\tTeff\tZ\txi\ta\tb\tFilt\tMet\tMod', '[cgs]\tK\t[Sun]\tkm/s\t\t\t\t\t', ...[4, 4.5].flatMap(g => [5750, 5875].map(t => `${g}\t${t}\t0\t2\t0.45\t0.26\tV\tL\tA`))].join('\n') : tlusty; } })).grid, 'atlas');
});

test('APOKASC-3 and Groenewegen (2013) rows draft single stars through the one route table; what a catalogue lacks is left to cite', async () => {
  const { parseApokascRow, draftFromApokasc } = await import('./archives/apokasc.mts'), { parseCepheidRow, draftFromCepheid } = await import('./archives/cepheids.mts'), { writeDrafts, DRAFT_ROUTES } = await import('./drafts.mts');
  // Rows as VizieR serves them, 2026-09-27: J/ApJS/276/69 table4 and J/A+A/550/A70 table10.
  const apokasc = ['KIC\tCatTab\tEvolSt\tMass\te_Mass\tRadius\te_Radius\tTeff\te_Teff\tloggSeis\te_loggSeis\tGaiaDR3', ' \t \t \tMsun\tMsun\tRsun\tRsun\tK\tK\t[cm.s-2]\t[cm.s-2]\t', '--------\t--------',
    '  893214\tGold    \tRGB    \t    1.4404\t    0.0602\t   11.0014\t    0.2055\t 4718.9233\t   44.7811\t    2.5146\t    0.0050\t2050237616959273728',
    ' 1026180\tDetectOl\tRC     \t    1.5334\t    0.0633\t   12.2361\t    0.2278\t 4576.1016\t   40.5161\t    2.4512\t    0.0050\t2050237174589477888'].join('\n');
  const giant = draftFromApokasc(parseApokascRow(apokasc, '893214'));
  assert.deepEqual([giant.id, giant.gaia, giant.radius.value, giant.mass.value, giant.temperature.value], ['kic-893214', '2050237616959273728', 11.0014, 1.4404, 4719]);
  assert.match(giant.description, /^A red giant climbing its first giant branch in the Kepler field, 11\.0 solar radii and 1\.44 solar masses/u);
  assert.doesNotThrow(() => parseStarSpec(giant), 'an APOKASC draft is a whole spec');
  assert.throws(() => parseApokascRow(apokasc, '1026180'), /KIC 1026180 is in category DetectOl; only Gold and Silver/u);
  const cepheids = ['recno\tLoc\tName\tE(B-V)\te_E(B-V)\tPer\tDist\te.D\tRad\te.R', ' \t \t \tmag\tmag\td\tpc\tpc\tRsun\tRsun', '--------\t-',
    '     129\tL\tHV 1005  \t 0.100\t 0.005\t18.714651\t44096.6\t1141.7\t 82.6\t 2.1'].join('\n');
  const { spec, missing } = draftFromCepheid(parseCepheidRow(cepheids, 'hv 1005'));
  assert.deepEqual([spec.id, spec.radius.value, spec.distance.value, spec.distance.uncertainty], ['hv-1005', 82.6, 44096.6, 1141.7]);
  assert.match(spec.description, /Large Magellanic Cloud that pulsates every 18\.71 days/u);
  assert.match(spec.color.reason, /E\(B-V\) = 0\.1 \+\/- 0\.005/u);
  assert.deepEqual(missing, ['temperature (a mean effective temperature, cited)', 'mass (cited, or "gaia-flame")']);
  assert.throws(() => parseStarSpec(spec), /hv-1005\.(mass|temperature)/u, 'refused until its mass and temperature are cited');
  // No Cepheid here has a dynamical mass: "unmeasured" keeps GM 0, and log g comes only from a cited gravity.
  const temperature = { value: 5500, source: 'a paper', url: star.paper.url }, gravity = { value: 1.2, source: 'a paper', url: star.paper.url };
  const bare = parseStarSpec({ ...spec, temperature, mass: 'unmeasured', gaia: '123456789' });
  assert.ok(Number.isNaN((await import('./generate.mts')).physicalValues(bare, { sourceId: '1', ra: 0, dec: 0, g: 13, hasXpSampled: false }).logg), 'no mass and no gravity: no log g, so no limb law');
  const measured = parseStarSpec({ ...spec, temperature, gravity, mass: 'unmeasured', gaia: '123456789' });
  const { physicalValues } = await import('./generate.mts'), values = physicalValues(measured, { sourceId: '1', ra: 0, dec: 0, g: 13, hasXpSampled: false });
  assert.deepEqual([values.gm, values.logg], [0, 1.2]);
  assert.match(values.massText, /No mass is measured, so GM is 0/u);
  assert.deepEqual(Object.keys(DRAFT_ROUTES), ['archive', 'debcat', 'apokasc', 'cepheids', 'k2', 'tess', 'gaia', 'hipparcos', 'iau', 'chara', 'npoi', 'sh0es', 'm31cepheids', 'm33cepheids', 'table']);
  await assert.rejects(writeDrafts('gcvs', ['X'], 'output/x.json', { root, progress: () => {}, archive: {} as Archive }), /No draft route gcvs; the routes are --from-archive, --from-debcat, --from-apokasc, --from-cepheids, --from-k2, --from-tess, --from-gaia/u);
});

test('a fast-moving star is looked up in SIMBAD where it was at J2000, not where Gaia saw it in 2016', async () => {
  const { simbadPosition } = await import('./generate.mts');
  // Sigma Draconis: Gaia DR3 at J2016.0, proper motion 597.384, -1738.286 mas/yr; SIMBAD lists 293.08996, 69.66118 (J2000), 30 arcseconds away.
  const at = simbadPosition({ ra: 293.09759805, dec: 69.65345106 }, { ra: 597.384, dec: -1738.286 });
  assert.ok(Math.abs(at.ra - 293.08996) < 1e-5 && Math.abs(at.dec - 69.66118) < 1e-5, `${at.ra}, ${at.dec}`);
  assert.deepEqual(simbadPosition({ ra: 10, dec: 0, epoch: 2000 }, { ra: 500, dec: 500 }), { ra: 10, dec: 0 }, 'a J2000 row is already there');
});

test('a CHARA row drafts a named star with its measured radius and temperature, and no mass when the paper fits none', async () => {
  const { parseCharaRow, draftFromChara } = await import('./archives/chara.mts');
  // Rows as VizieR serves them, 2026-10-01: J/ApJ/746/101 targets.
  const rows = ['HD\tSpT\tPlx\te_Plx\tD(LD)\te_D(LD)\tR\te_R\tTeff\te_Teff\tM\te_M', ' \t \tmas\tmas\tmas\tmas\tRsun\tRsun\tK\tK\tMsun\tMsun', '------\t------',
    '102870\tF8.5IV-V  \t 91.50\t 0.22\t 1.431\t 0.006\t 1.681\t 0.008\t6132\t 26\t 1.324\t 0.005',
    '185144\tG9V       \t173.77\t 0.18\t 1.254\t 0.012\t 0.776\t 0.008\t5255\t 31\t      \t      '].join('\n');
  const named = draftFromChara(parseCharaRow(rows, '102870'), ['HD 102870', 'NAME Zavijava', '* bet Vir']);
  assert.deepEqual([named.id, named.name, named.target, named.featured, named.aliases, named.radius.value, named.temperature.value], ['zavijava', 'Zavijava', 'HD 102870', true, ['HD 102870'], 1.681, 6132]);
  assert.deepEqual([named.distance.value, named.distance.uncertainty], [10.929, 0.026], 'placed at the parallax the radius was computed with');
  assert.match(typeof named.mass === 'string' ? '' : named.mass.source, /Yonsei-Yale isochrones.*a model value/u, 'the mass is cited as the model value it is');
  assert.doesNotThrow(() => parseStarSpec(named), 'a CHARA draft is a whole spec');
  const bare = draftFromChara(parseCharaRow(rows, '185144'), ['HD 185144', '*  61 Dra', '* sig Dra']);
  assert.deepEqual([bare.id, bare.name, bare.mass, bare.featured], ['sigma-draconis', 'Sigma Draconis', 'unmeasured', undefined]);
  assert.match(bare.description, /^A naked-eye star 5\.8 parsecs away, 78% of the Sun's width/u);
  assert.throws(() => parseCharaRow(rows, '1'), /has 0 rows for HD 1, not one/u);
});

test('a K2 giant is drafted at its asteroseismic distance only when both pipelines agree on its radius', async () => {
  const { parseK2Row, draftFromK2 } = await import('./archives/k2.mts');
  // Rows as VizieR serves them, 2026-09-28: J/A+A/677/A21 k2_apo, one request per EPIC number.
  const k2 = (row: string) => ['K2-ID\tK2-camp\tGaiaEDR3\tTeff-A\te_Tefffin-A\tMass-M\tb_Mass-M\tB_Mass-M\tRad-M\tb_Rad-M\tB_Rad-M\tRad-E\tb_Rad-E\tB_Rad-E\tDist-M\tb_Dist-M\tB_Dist-M\tAV-M\tFlags-A',
    ' \t \t \tK\tK\tMsun\tMsun\tMsun\tRsun\tRsun\tRsun\tRsun\tRsun\tRsun\tpc\tpc\tpc\tmag\t', '-----------------\t----', row].join('\n');
  const far = k2('KTWO201541578-C01\t 1.0\t3796334722650394496\t5195.2929999999997\t 50\t  1.696545\t  1.680289\t  1.716048\t 20.088517\t 19.919159\t 20.310380\t 21.922053\t 20.673548\t 25.007332\t 18070.781250\t 17810.937500\t 18341.875000\t  0.335329\t');
  const giant = draftFromK2(parseK2Row(far, '201541578'));
  assert.deepEqual([giant.id, giant.gaia, giant.radius.value, giant.mass.value, giant.distance.value, giant.distance.uncertainty, giant.temperature.value],
    ['epic-201541578', '3796334722650394496', 20.0885, 1.6965, 18070.8, 265.5, 5195]);
  assert.match(giant.radius.source, /16th-84th percentiles 19\.919159-20\.31038\), MA09 pipeline/u);
  assert.doesNotThrow(() => parseStarSpec(giant), 'a K2 draft is a whole spec');
  const split = k2('KTWO201483992-C10\t10.0\t3698838449635055360\t5165.8612999999996\t 50\t  2.652693\t  2.550345\t  2.738523\t 21.259744\t 20.746631\t 21.731653\t 10.627683\t 10.278545\t 11.072674\t 17795.781250\t 17453.125000\t 18132.343750\t -0.076852\t');
  assert.throws(() => parseK2Row(split, '201483992'), /EPIC 201483992: the two pipelines disagree on its radius, MA09 21\.259744 .* and E20 10\.627683/u);
  assert.throws(() => parseK2Row(far, '201483992'), /k2_apo has 0 rows for EPIC 201483992/u);
});

test('a K2 star APOGEE did not observe is read from the K2 + GALAH table, and a TESS star from TESS + APOGEE', async () => {
  const { parseK2Row, draftFromK2, draftsFromK2 } = await import('./archives/k2.mts');
  // Rows as VizieR serves them, 2026-09-28: J/A+A/677/A21 k2_gal and tess_apo.
  const galah = ['K2-ID\tK2-camp\tTeff-G\tTefffin-G\tFlagsp-G\tGaiaEDR3\tMass-M\tb_Mass-M\tB_Mass-M\tRad-M\tb_Rad-M\tB_Rad-M\tRad-E\tb_Rad-E\tB_Rad-E\tDist-M\tb_Dist-M\tB_Dist-M\tAV-M',
    ' \t \tK\tK\t \t \tMsun\tMsun\tMsun\tRsun\tRsun\tRsun\tRsun\tRsun\tRsun\tpc\tpc\tpc\tmag', '-----------------\t----',
    'KTWO201102783-C10\t10.0\t4750.3842999999997\t172\t   0\t3596221888408872576\t  0.942704\t  0.868417\t  1.051086\t  7.325341\t  7.081329\t  7.660654\t  7.518303\t  7.244397\t  7.833006\t  1924.082031\t  1860.175781\t  2007.773438\t  0.031174'].join('\n');
  const empty = 'K2-ID\tK2-camp\n \t \n-----\n';
  const archive = { text: async (_url: string, query: Record<string, string>) => query['-source']!.endsWith('k2_gal') ? galah : empty } as unknown as Archive;
  const [giant] = (await draftsFromK2(['201102783'], archive)).stars as ReturnType<typeof draftFromK2>[];
  assert.deepEqual([giant!.id, giant!.temperature.value, giant!.temperature.uncertainty, giant!.distance.value], ['epic-201102783', 4750, 172, 1924.1]);
  assert.match(giant!.temperature.source, /k2_gal, EPIC 201102783: GALAH DR3 effective temperature/u);
  assert.match(giant!.text.introduction, /GALAH spectra give 4,750 K/u);
  assert.throws(() => parseK2Row(galah.replace('\t   0\t', '\t   1\t'), '201102783', 'k2_gal'), /GALAH's stellar-parameter flag is 1, not 0/u);
  const tess = ['TIC\tTeff-A\te_Tefffin-A\tFlags-A\tGaiaEDR3\tMass-M\tb_Mass-M\tB_Mass-M\tRad-M\tb_Rad-M\tB_Rad-M\tRad-E\tb_Rad-E\tB_Rad-E\tDist-M\tb_Dist-M\tB_Dist-M\tAV-M',
    ' \tK\tK\t \t \tMsun\tMsun\tMsun\tRsun\tRsun\tRsun\tRsun\tRsun\tRsun\tpc\tpc\tpc\tmag', '---------\t---',
    "261154892\t4801.1396\t50\tb''                      \t4623618644463488128\t  0.976482\t  0.932515\t  1.038155\t 10.922879\t 10.750088\t 11.162125\t 10.785345\t 10.393365\t 11.224641\t 1005.322266\t  994.296875\t 1017.207031\t  0.488677"].join('\n');
  const star = draftFromK2(parseK2Row(tess, '261154892', 'tess_apo'));
  assert.deepEqual([star.id, star.name, star.gaia, star.radius.value], ['tic-261154892', 'TIC 261154892', '4623618644463488128', 10.9229]);
  assert.match(star.description, /^A red giant observed by TESS, 10\.9 solar radii/u);
  assert.doesNotThrow(() => parseStarSpec(star), 'a TESS draft is a whole spec');
});

test('a star anywhere on the sky drafts from Gaia DR3 alone when the archive flags vouch for its FLAME chain', async () => {
  const { parseGaiaDraftRow, draftFromGaia } = await import('./archives/gaia.mts');
  // The row as the Gaia Archive serves it, 2026-09-28.
  const header = 'source_id,parallax,parallax_error,ruwe,flags_flame,radius_flame,mass_flame,teff_gspphot,teff_gspphot_lower,teff_gspphot_upper,ag_gspphot';
  const row = '6711869948052992,0.11950849172011525,0.015932519,1.145126,10,15.559747,3.3650587,6087.612,6071.958,6095.802,0.8901';
  const star = draftFromGaia(parseGaiaDraftRow(`${header}\n${row}`, '6711869948052992'));
  assert.deepEqual([star.id, star.gaia, star.radius, star.mass, star.temperature.value, star.temperature.uncertainty], ['gaia-dr3-6711869948052992', '6711869948052992', 'gaia-flame', 'gaia-flame', 6088, 11.9]);
  assert.match(star.text.card, /^A star about 8,400 parsecs away, 16 times the Sun's width/u);
  assert.doesNotThrow(() => parseStarSpec(star), 'a Gaia draft is a whole spec');
  // FLAME from the GSP-Phot distance instead of the parallax (second digit 1), or no mass (first digit 2), is refused.
  assert.throws(() => parseGaiaDraftRow(`${header}\n${row.replace(',10,', ',11,')}`, '6711869948052992'), /flags_flame is 11; only 00 and 10/u);
  assert.throws(() => parseGaiaDraftRow(`${header}\n${row.replace(',10,', ',20,')}`, '6711869948052992'), /flags_flame is 20/u);
  assert.throws(() => parseGaiaDraftRow(`${header}\n${row.replace(',1.145126,', ',1.52,')}`, '6711869948052992'), /RUWE 1.52 is not below 1.4/u);
});

test('a Gaia source SIMBAD never catalogued is identified by that source; a target without one is refused', async () => {
  const { identify } = await import('./archives/archives.mts');
  const unknown = async () => undefined;
  assert.deepEqual(await identify(unknown, 'Gaia DR3 6881624509796808576', '6881624509796808576', 'gaia-dr3-6881624509796808576'), { main: 'Gaia DR3 6881624509796808576', gaia: '6881624509796808576' });
  await assert.rejects(identify(unknown, 'HV 9999', undefined, 'hv-9999'), /hv-9999: SIMBAD does not know HV 9999\./u);
});

test('a binary component the archive writes apart is looked up under the name SIMBAD joins', async () => {
  const { identify } = await import('./archives/archives.mts');
  // SIMBAD, 2026-09-29: "K2-288 B", the archive's hostname, is not an identifier; K2-288B is LP 413-32 B, with Gaia DR2
  // 44838019756570112 and no DR3 source (Gaia's dr2_neighbourhood maps that DR2 source to K2-288 A, 0.79 arcsec away), so it is refused.
  const simbad = async (name: string) => name === 'K2-288B' ? { mainId: 'LP 413-32 B', identifiers: ['LP 413-32 B', 'Gaia DR2 44838019756570112', 'NAME K2-288B'] } : undefined;
  await assert.rejects(identify(simbad, 'K2-288 B', undefined, 'k2-288-b'), /k2-288-b: SIMBAD lists no Gaia DR3 identifier for K2-288 B/u);
  const withDr3 = async (name: string) => name === 'Star 1B' ? { mainId: 'Star 1B', identifiers: ['Gaia DR3 1'] } : undefined;
  assert.deepEqual(await identify(withDr3, 'Star 1 B', undefined, 'star-1-b'), { main: 'Star 1B', gaia: '1' });
});

test('a binary whose primary Gaia sees eclipsing on another period is refused; long orbits Gaia cannot measure are not checked', async () => {
  const { eclipsingPeriodAgrees, GAIA_EB_CHECKED_DAYS } = await import('./generate.mts');
  // Gaia DR3 vari_eclipsing_binary, 2026-09-28: 6045477944460616704 (Cl* NGC 6121 SAW V66) 0.26988 d; the M4 V66 of Kaluzny et al.
  // (2013) is an 8.11-day pair. 4658260373306002944 (OGLE-LMC-ECL-09114, the right star by position) 2.99898 d for a 214.37-day orbit.
  assert.equal(eclipsingPeriodAgrees(8.11130346, 0.2698801868), false, 'the namesake variable is refused');
  assert.equal(eclipsingPeriodAgrees(8.11130346, 8.1113 / 2), true, 'half the period is the same binary');
  assert.equal(eclipsingPeriodAgrees(8.11130346, undefined), true, 'no Gaia solution is not a check');
  assert.equal(eclipsingPeriodAgrees(214.3655, 2.998979), true, 'a long orbit Gaia saw twice is not checked');
  assert.ok(GAIA_EB_CHECKED_DAYS > 100 && GAIA_EB_CHECKED_DAYS < 110);
});
