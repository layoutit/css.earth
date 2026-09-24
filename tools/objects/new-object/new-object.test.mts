/** The object generator's decisions, offline: the spec it accepts, the colour route it picks and the gaps it declares, the orbits it
 * writes from each route, checked against packages that already ship. */
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { gzipSync } from 'node:zlib';
import { sourceTest } from '../../../tests/objects/source-test.mts';
import { parseCieTable } from '../observation/disc-integrated-color.mts';
import { readCie1931ColorMatching } from '../../references/reference-bank.mts';
import { readIdentifiers, type Archive, type GaiaRow } from './archives.mts';
import { chooseColor, coverageGaps } from './color.mts';
import { assembleArchiveOrbit, orbitizeHostedOrbit, parseArchiveRows } from './orbit.mts';
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

test('a transiting orbit is one paper\'s archive row, with gaps filled from other rows and a/R* derived when no row has it', async () => {
  const header = 'pl_name,pl_refname,default_flag,pl_orbper,pl_ratdor,pl_orbincl,pl_orbeccen,pl_orblper,pl_tranmid,pl_radj,pl_bmassj,pl_orbsmax,st_rad,st_mass,pl_bmassjlim,pl_imppar,pl_trandur,pl_ratror';
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
  const { spelledOut } = await import('./prose.mts');
  assert.deepEqual(['55 Cnc e', 'eps Ind A', 'HU Aqr', 'ups And b', 'mu2 Sco', 'HD 219134 b', 'Kepler-62 f', 'TOI-700'].map(spelledOut),
    ['55 Cancri e', 'Epsilon Indi A', 'HU Aquarii', 'Upsilon Andromedae b', 'Mu2 Scorpii', 'HD 219134 b', 'Kepler-62 f', 'TOI-700'], 'as Wikipedia titles the articles');
});

test('a planet takes its colour from what is measured: the emission row with the smallest relative uncertainty, else its host\'s light on the gray', async () => {
  const { EMISSION_COLUMNS, parseEmissionRows, pickThermalRow } = await import('./planet-lenses.mts');
  const { hostLitGray } = await import('../color-transfer.mts');
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

test('band photometry in a spec is checked by the lens\'s own parser: three bands red to blue on a shared range from zero', async () => {
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

test('a generated planet with a measured dayside temperature keeps its thermal lens text; the shape-only text is only for a shape planet', async () => {
  const { hostedPackage } = await import('./hosted.mts');
  const { EMISSION_COLUMNS } = await import('./planet-lenses.mts');
  const emission = [EMISSION_COLUMNS, 'HD 219134 b,4.5,1.0,300,45,-45,0,1400,80,-80,0,Spitzer,IRAC,"<a refstr=Y href=https://ui.adsabs.harvard.edu/abs/2018AJ....155...29K/abstract target=ref>Kammer et al. 2018</a>"'].join('\n');
  const archive: Archive = { async text(url) { if (url.includes('emissionspec')) return emission; throw new Error(`unexpected ${url}`); }, async bytes() { throw new Error('none'); }, async exists() { return false; } };
  const paper = { id: 'arxiv-2110-06729', title: 'A paper', creators: ['A Author'], year: '2022', url: star.paper.url, arxiv: '2110.06729' };
  const host = { id: 'hd-219134', physical: { name: 'HD 219134', meanRadiusKm: 695700, gravitationalParameterKm3PerS2: 132712440041.9, parent: null }, star: { distanceParsecs: 10, rightAscensionDegrees: 0, declinationDegrees: 0, positionEpochJulianYear: 2016, properMotionRaMasPerYear: 0, properMotionDecMasPerYear: 0, radialVelocityKmPerS: 0 } };
  const orbit = { periodDays: 3, semiMajorAxisStellarRadii: 9, inclinationDegrees: 88, eccentricity: 0, transitTimeBmjdTdb: 59000, ascendingNodePositionAngleDegrees: 0, sources: { period: 'p', shape: 's', eccentricity: 'e', phase: 'ph', orientation: 'o' } };
  const cited = { value: 1, source: 's', url: star.paper.url };
  const thermal = { temperatureK: 1400, uncertaintyK: 80, wavelengthMicrometres: 4.5, facility: 'Spitzer IRAC', source: 'Kammer et al. 2018, dayside brightness temperature at 4.5 µm', url: 'https://ui.adsabs.harvard.edu/abs/2018AJ....155...29K/abstract', chosen: '1 measured of 1 rows' };
  const build = async (extra: Record<string, unknown>, mass: typeof cited & { limit?: true; unmeasured?: true } = cited) => {
    const spec = parseStarSpec({ ...star, planets: [{ id: 'hd-219134b', name: 'HD 219134 b', description: 'A planet.', text: { card: 'A planet.', introduction: 'A planet made from fixtures.', locator: 'fixture' }, paper: star.paper, radius: cited, mass: cited, orbit: { elements: { periodDays: 3, semiMajorAxisStellarRadii: 9, inclinationDegrees: 88, eccentricity: 0, transitTimeBmjdTdb: 59000 }, source: 's', url: star.paper.url }, ...extra }] }).planets[0]!;
    const body = { id: spec.id, classification: 'exoplanet', order: 2, physical: { name: spec.name, horizonsCode: null, meanRadiusKm: 71492, gravitationalParameterKm3PerS2: 126686531.9, parent: 'hd-219134' }, physicalNotes: 'n', hostedOrbit: orbit };
    const record = { spec, hostId: 'hd-219134', system: 'HD 219134 system', body, order: 2, orbit, orbitCitation: { text: 's', url: star.paper.url, label: 's' }, radius: cited, mass, documents: new Map<string, string>(), todo: [] };
    const { files } = await hostedPackage(record, host, new Map([[star.paper.url, paper]]), archive, root, 2460000);
    const text = JSON.parse(String(files.get('src/objects/hd-219134b/text.json'))), content = JSON.parse(String(files.get('src/objects/hd-219134b/source/content/object.json')));
    assertWholePackage(files, 'hd-219134b', true);
    return { datasets: Object.keys(text.datasets), notes: String(content.lenses.controls[0].notes), lens: String(content.lenses.controls[0].id), facts: content.panel.facts as { id: string; value: string }[] };
  };
  const glow = await build({ thermal });
  assert.deepEqual([glow.lens, glow.datasets], ['thermal', ['thermal']]);
  assert.match(glow.notes, /black body at the dayside brightness temperature/u);
  const shape = await build({});
  assert.deepEqual([shape.lens, shape.datasets], ['shape', ['shape']]);
  assert.match(shape.notes, /the gray marks an unresolved surface/u);
  // Host light adds its sentence to the base note; the scaffold's TODO never survives (a regression #691 introduced).
  assert.doesNotMatch(shape.notes, /TODO/u);
  assert.match(shape.notes, /takes the colour of hd-219134's light/u);
  // A mass that is only an upper limit is shown as one.
  assert.equal((await build({}, { ...cited, value: 0.12, limit: true })).facts.find(fact => fact.id === 'mass')!.value, 'Under 0.12 Jupiter masses');
  assert.equal((await build({}, { ...cited, value: 0, unmeasured: true })).facts.find(fact => fact.id === 'mass')!.value, 'Not measured');
});

test('a planet whose archive mass is only an upper limit gets GM 0, the records\' unpublished value, and the limit in its notes', async () => {
  const { hostedRecord } = await import('./hosted.mts');
  const anchor = '"<a refstr=BORUCKI_ET_AL__2013 href=https://ui.adsabs.harvard.edu/abs/2013Sci...340..587B/abstract target=ref>Borucki et al. 2013</a>"';
  const ps = ['pl_name,pl_refname,default_flag,pl_orbper,pl_ratdor,pl_orbincl,pl_orbeccen,pl_orblper,pl_tranmid,pl_radj,pl_bmassj,pl_orbsmax,st_rad,st_mass,pl_bmassjlim,pl_imppar,pl_trandur,pl_ratror',
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

test('a Planck colour outside sRGB (a cool companion) is shown desaturated and the record says so; one inside keeps its record plain', async () => {
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
  const stars = ['pl_name,hostname,default_flag,pl_refname,st_refname,st_rad,st_raderr1,st_teff,st_tefferr1,st_mass,st_masserr1,sy_dist,disc_year,discoverymethod,tran_flag,pl_letter,hd_name,hip_name,gaia_dr3_id,cb_flag,sy_snum',
    `HD 1 c,HD 1,1,${ref('Two et al. 2020', '2020AJ....1....2T')},${ref('Two et al. 2020', '2020AJ....1....2T')},0.8,0.02,5000,50,0.85,0.03,20.5,2020,Transit,1,c,HD 1,,Gaia DR3 123456789,0,1`,
    `HD 1 b,HD 1,1,${ref('One et al. 2019', '2019AJ....1....1O')},${ref('One et al. 2019', '2019AJ....1....1O')},0.8,0.02,5000,50,0.85,0.03,20.5,2019,Transit,1,b,HD 1,,Gaia DR3 123456789,0,1`,
    `HD 1 d,HD 1,1,${ref('Three et al. 2021', '2021AJ....1....3T')},${ref('Three et al. 2021', '2021AJ....1....3T')},0.8,,5000,,0.85,,20.5,2021,Radial Velocity,0,d,HD 1,,Gaia DR3 123456789,0,1`].join('\n');
  // GJ 436's case: the default row leaves the stellar temperature empty and another paper's row gives it.
  const gapped = stars.replaceAll(',5000,50,', ',,,').replace(',5000,,', ',,,') + `\nHD 1 b,HD 1,0,${ref('Four et al. 2022', '2022AJ....1....4F')},${ref('Four et al. 2022', '2022AJ....1....4F')},0.81,,5010,40,0.86,,20.5,2019,Transit,1,b,HD 1,,Gaia DR3 123456789,0,1`;
  const ps = ['pl_name,pl_refname,default_flag,pl_orbper,pl_ratdor,pl_orbincl,pl_orbeccen,pl_orblper,pl_tranmid,pl_radj,pl_bmassj,pl_orbsmax,st_rad,st_mass,pl_bmassjlim,pl_imppar,pl_trandur,pl_ratror',
    `"HD 1 c",${ref('Two et al. 2020', '2020AJ....1....2T')},1,10.0,20.0,89.0,0,,2459000.5,0.2,0.02,,0.8,0.85,0`,
    `"HD 1 b",${ref('One et al. 2019', '2019AJ....1....1O')},1,3.0,9.0,88.0,0,,2458000.5,0.1,0.01,,0.8,0.85,0`].join('\n');
  const composite = (name: string, mass: number) => `pl_name,pl_bmassj,pl_bmassjlim,pl_bmassprov,pl_bmassj_reflink\n"${name}",${mass},0,Mass,${ref('One et al. 2019', '2019AJ....1....1O')}`;
  const { EMISSION_COLUMNS } = await import('./planet-lenses.mts');
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
  const planets = spec.planets as { id: string; thermal?: unknown; text: { card: string } }[];
  assert.deepEqual(planets.map(planet => planet.id), ['hd-1b', 'hd-1c'], 'innermost first, whatever the archive order');
  assert.deepEqual([planets[0]!.thermal !== undefined, planets[1]!.thermal !== undefined], [true, false]);
  assert.match(skipped.join('; '), /HD 1 d: found by radial velocity, not a transit fit/u);
  assert.match(notes.join('; '), /HD 1 c: no measured dayside brightness temperature/u);
  assert.equal((spec.temperature as { value: number }).value, 5000);
  assert.equal(spec.gaia, '123456789', 'the archive\'s Gaia DR3 id, which SIMBAD must agree with');
  // A host the universe holds under another id, found by the name its planets use: its new planets become an addition to it.
  const held = await archiveSpec(archive, 'HD 1', { ids: new Set(['hd-1b-host']), names: new Map([['hd1', 'hd-1b-host']]), stars: [] });
  assert.equal(held.spec.host, 'hd-1b-host');
  assert.deepEqual((held.spec.planets as { id: string }[]).map(planet => planet.id), ['hd-1b-host-b', 'hd-1b-host-c']);
  assert.match(planets[0]!.text.card, /^HD 1 b crosses its star every 3 days/u);
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
  await assert.rejects(archiveSpec(rvOnly, 'HD 1', { ids: new Set(), names: new Map(), stars: [] }), /^Error: HD 1: no planet to add; HD 1 d: found by radial velocity, not a transit fit\.$/u);
  // No archive row gives a temperature: TIC v8.2's for the same Gaia source, cited to it.
  const noTeff = stars.replaceAll(',5000,50,', ',,,').replace(',5000,,', ',,,');
  const tic = ['#', 'TIC\tTeff\ts_Teff\tRad\ts_Rad\tMass\ts_Mass', '\t\t\t\t\t\t', '---\t---\t---\t---\t---\t---\t---', '42\t4800\t120\t0.79\t0.04\t0.84\t0.1'].join('\n');
  const ticArchive = { ...archive, async text(url: string) { if (url.includes('asu-tsv')) return new URL(url).searchParams.get('GAIA') === '123456789' ? tic : ''; const query = decodeURIComponent(new URL(url).searchParams.get('query') ?? ''); return query.includes('st_teff') ? noTeff : archive.text(url); } };
  const fromTic = (await archiveSpec(ticArchive, 'HD 1', { ids: new Set(), names: new Map(), stars: [] })).spec;
  assert.deepEqual([(fromTic.temperature as { value: number }).value, (fromTic.temperature as { uncertainty: number }).uncertainty], [4800, 120]);
  assert.match((fromTic.temperature as { source: string }).source, /TIC 42 \(VizieR IV\/39\/tic82\); no NASA Exoplanet Archive row gives one/u);
  assert.match((fromTic.text as { card: string }).card, /4,800 K/u);
  const noGaia = { ...ticArchive, async text(url: string) { return url.includes('asu-tsv') ? '' : ticArchive.text(url); } };
  await assert.rejects(archiveSpec(noGaia, 'HD 1', { ids: new Set(), names: new Map(), stars: [] }), /no archive row gives a stellar temperature, nor does TIC v8.2 for Gaia DR3 123456789/u);
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
  const drafted = 'X b crosses its star every 3 days. This account was drafted from A et al.\'s values; the sections below are the data\'s own.';
  const readme = (opening: string, extra = '') => `# X b\n\n## Sources\n\n${opening}\n\n**Orbit.** P 3 d.\n\n## Evidence\n\nGenerated 2026-09-24 by new-object.\n${extra}\n## Known problems\n\n- **Drafted text.** The card was drafted.\n\n[Investigation ledger](investigations.json) · [Credits](NOTICE.md)\n`;
  const regenerated = readme(drafted.replace('3 days', '3.1 days')).replace('P 3 d', 'P 3.1 d');
  const dir = await mkdtemp(resolve(tmpdir(), 'cssearth-refresh-'));
  try {
    const o = resolve(dir, 'src/objects/x-b'), put = async (path: string, value: unknown) => { await mkdir(resolve(o, path, '..'), { recursive: true }); await writeFile(resolve(o, path), typeof value === 'string' ? value : JSON.stringify(value)); };
    const spec = { kind: 'planet' as const, id: 'x-b', name: 'X b', description: 'd', paper: { url: 'https://arxiv.org/abs/2110.06729', credit: 'A' }, orbit: { archive: 'nasa-ps' as const }, text: { card: 'X b crosses its star every 3 days.', introduction: drafted.split(' This account')[0]!, locator: 'row' } };
    await put(STORED_SPEC, storedHostedSpec(spec, 'x', 7));
    await put('source/content/object.json', { lenses: { controls: [{ id: 'shape' }] } });
    await put('source/manifest.json', { inputs: [{ path: 'photometry/old.csv' }], documents: [] });
    await put('text.json', { card: { text: 'A person\'s card.' }, introduction: { text: spec.text.introduction } });
    await put('README.md', readme(drafted)); await put('investigations.json', { entries: ['a person\'s'] });
    const files = new Map<string, string>([['src/objects/x-b/source/content/object.json', JSON.stringify({ lenses: { controls: [{ id: 'shape' }] } })],
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
    // A person's lens is never dropped.
    await put('source/content/object.json', { lenses: { controls: [{ id: 'shape' }, { id: 'radial-field-2017' }] } });
    await assert.rejects(mergeRefresh(files, 'x-b', dir), /lenses the tool does not make \(radial-field-2017\)/u);
    await assert.rejects(refreshSpec(dir, ['hand-made']), /not made by new-object/u);
  } finally { await rm(dir, { recursive: true, force: true }); }
});

test('a wide companion is drafted as a placed star of the host\'s system from the three catalogues; a circumbinary host is refused', async () => {
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
  const { companions, notes } = await wideCompanions(archive, { gaia: '846946621395854848', name: 'HAT-P-22', system: 'HAT-P-22 system' }, () => undefined);
  assert.deepEqual(notes, []);
  const star = companions[0]! as { id: string; name: string; system: string; gaia: string; temperature: { value: number; uncertainty: number; source: string }; radius: { value: number }; mass: { value: number }; text: { card: string } };
  assert.deepEqual([star.id, star.name, star.system, star.gaia, star.temperature.value, star.temperature.uncertainty, star.radius.value, star.mass.value], ['hd-233731-b', 'HD 233731B', 'HAT-P-22 system', '846946625690867328', 3589, 157, 0.599, 0.587]);
  assert.match(star.temperature.source, /TIC 252479261/u);
  assert.doesNotThrow(() => parseStarSpec(star), 'the draft is a valid star spec');
  const held = await wideCompanions(archive, { gaia: '846946621395854848', name: 'HAT-P-22', system: 's' }, () => 'hd-233731-b');
  assert.deepEqual([held.companions.length, /already in the universe as hd-233731-b/u.test(held.notes[0]!)], [0, true]);
  // A circumbinary host: the pair's orbit is a paper's, so the draft refuses it.
  const cb = { async text(url: string) { if (decodeURIComponent(url).includes('st_teff')) return 'pl_name,hostname,default_flag,pl_refname,st_refname,st_rad,st_raderr1,st_teff,st_tefferr1,st_mass,st_masserr1,sy_dist,disc_year,discoverymethod,tran_flag,pl_letter,hd_name,hip_name,gaia_dr3_id,cb_flag,sy_snum\nTOI-1338 b,TOI-1338,1,x,x,1,,5990,,1,,400,2020,Transit,1,b,,,Gaia DR3 1,1,2'; return ''; }, async bytes() { throw new Error('none'); }, async exists() { return false; } };
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

test('a reference the archive cites only by its ADS bibcode is read as the paper it links to, keeping the bibcode', async () => {
  const { fetchPublication } = await import('./archives.mts');
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
  const spec = parseStarSpec({ ...star, id: 'test-fixture-star', name: 'Test Fixture Star', gaia, target: undefined, limb: { none: 'a test fixture' },
    text: { card: 'A test star.', introduction: 'A test star made from fixtures.', locator: 'fixture' } });
  const generated = await generateStar(spec, { archive, root, order: 9999, universe: { ids: new Set(), names: new Map(), stars: [] },
    resolver: async () => ({ mainId: 'Test Fixture Star', identifiers: [`Gaia DR3 ${gaia}`] }) });
  assert.equal(generated.color.route, 'planck', 'no archive spectrum in the fixtures, so the Planck route');
  assertWholePackage(generated.files, spec.id, true);
  const stored = parseObjectSpecs({ stars: [JSON.parse(String(generated.files.get(`src/objects/${spec.id}/${STORED_SPEC}`)))] }).stars[0]!;
  assert.deepEqual(stored, { ...spec, order: 9999 }, 'the stored spec reads back to the spec that made the package');
});

test('an imaged planet\'s K, H and J magnitudes become the band colour, each cited to its paper; a planet missing a band is named', async () => {
  const { draftUltracoolPhotometry, readCsv, ULTRACOOL } = await import('./ultracool.mts');
  const { parsePhotometryEntries } = await import('./spec.mts');
  assert.deepEqual(readCsv('a,b\n"x, y",2\n'), [{ a: 'x, y', b: '2' }]);
  const main = 'name,name_simbad,name_simbadable,J_MKO,Jerr_MKO,ref_J_MKO,H_MKO,Herr_MKO,ref_H_MKO,K_MKO,Kerr_MKO,ref_K_MKO\n51 Eri b,* 51 Eri b,* 51 Eri b,19.04,0.40,Raja17,18.99,0.21,Raja17,18.67,0.19,Raja17\nAF Lep b,null,null,19.22,0.1,X,18.61,0.1,X,NaN,NaN,null\n';
  const refs = 'code_ref,ADSkey_ref,Paperskey_ref,citetext_ref,title_ref,notes_ref\nRaja17,2017AJ....154...10R,k,Rajan et al. (2017),"Characterizing 51 Eri b, 1 to 5 um",\n';
  const svo = (lambda: number, zero: number) => `<PARAM name="WavelengthEff" value="${lambda}"/><PARAM name="ZeroPoint" value="${zero}"/>`;
  const archive: Archive = { async text(url, form) {
    if (form?.QUERY?.includes("'51 Eridani b'")) return 'main_id\n"*  51 Eri b"'; if (form?.QUERY) return 'main_id\n';
    if (url === ULTRACOOL.main) return main; if (url === ULTRACOOL.references) return refs;
    if (url.includes('NSFCam.K')) return svo(21840.23, 638.185); if (url.includes('NSFCam.H')) return svo(16140.31, 1034.805); if (url.includes('NSFCam.J')) return svo(12417.04, 1544.028);
    throw new Error(`unexpected ${url}`); }, async bytes() { throw new Error('none'); }, async exists() { return false; } };
  const { entries, notes } = await draftUltracoolPhotometry(archive, [{ id: 'hd-29391-b', name: '51 Eridani b' }, { id: 'af-lep-b', name: 'AF Lep b' }, { id: 'x', name: 'Nobody b' }]);
  const photometry = entries[0]!.photometry;
  assert.deepEqual(photometry.bands.map(band => band.band), ['MKO K', 'MKO H', 'MKO J'], 'red is the longest wavelength');
  assert.equal(photometry.bands[0]!.value, Number((638.185 * 10 ** (-0.4 * 18.67) * 1e6).toPrecision(4)), 'F = zero point x 10^(-0.4 m)');
  assert.equal(photometry.source.url, 'https://ui.adsabs.harvard.edu/abs/2017AJ....154...10R');
  assert.match(photometry.source.citation, /^Rajan et al\. \(2017\), as compiled in Best/u);
  assert.equal(photometry.displayRange[1], Math.max(...photometry.bands.map(band => band.value)));
  assert.doesNotThrow(() => parsePhotometryEntries(entries), 'the lens\'s own parser accepts the draft');
  assert.deepEqual(notes.map(note => note.split(':')[0]), ['af-lep-b', 'x']);
  assert.match(notes[0]!, /no MKO K magnitude/u);
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
  const { liveArchive } = await import('./archives.mts');
  const real = globalThis.fetch, answers = [503, 200, 404];
  let calls = 0;
  globalThis.fetch = (async () => { calls++; const status = answers.shift()!; return new Response(status === 200 ? 'rows' : 'busy', { status }); }) as typeof fetch;
  try {
    assert.equal(await liveArchive.text('https://example.invalid/tap'), 'rows');
    assert.equal(calls, 2, 'the 503 was asked again once');
    await assert.rejects(liveArchive.text('https://example.invalid/tap'), /answered 404/u);
    assert.equal(calls, 3, 'the 404 was not');
  } finally { globalThis.fetch = real; }
});
