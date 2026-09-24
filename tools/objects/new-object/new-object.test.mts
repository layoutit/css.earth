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

test('a transiting orbit is one paper\'s archive row, with gaps filled from other rows and a/R* derived when no row has it', () => {
  const header = 'pl_name,pl_refname,default_flag,pl_orbper,pl_ratdor,pl_orbincl,pl_orbeccen,pl_orblper,pl_tranmid,pl_radj,pl_bmassj,pl_orbsmax,st_rad,st_mass,pl_bmassjlim';
  const anchor = (ref: string, bib: string, label: string) => `"<a refstr=${ref} href=https://ui.adsabs.harvard.edu/abs/${bib}/abstract target=ref>${label}</a>"`;
  const csv = [header,
    `"WASP-121 b",${anchor('BOURRIER_ET_AL__2020', '2020A&A...635A.205B', 'Bourrier et al. 2020')},0,1.27492504,3.8131,88.49,0,10,2458119.72074,1.753,1.157,,1.458,1.353,0`,
    `"X b",${anchor('A_ET_AL__2019', '2019AJ....157...1A', 'A et al. 2019')},1,5.0,,87.0,0.2,95.0,2458000.5,1.0,,0.05,1.0,1.0,`,
    `"X b",${anchor('B_ET_AL__2021', '2021AJ....161...2B', 'B et al. 2021')},0,5.0,,,,,,1.1,0.9,,,,0`,
    `"Y b",${anchor('C_ET_AL__2022', '2022AJ....163...3C', 'C et al. 2022')},1,2.0,8.0,89.0,0,,2459000.5,0.2,0.05,,,,1`].join('\n');
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
  // A flagged upper limit is not a mass: the archive's calculated value serves, or the planet is refused.
  const y = rows.filter(row => row.name === 'Y b');
  assert.equal(y[0]!.massJupiter, undefined); assert.equal(y[0]!.massLimitJupiter, 0.05);
  assert.match(assembleArchiveOrbit(y, undefined, { value: 0.002, provenance: 'M-R relationship', limit: false, label: 'Calculated Value' }).mass.row.label, /calculated value/u);
  assert.throws(() => assembleArchiveOrbit(y, undefined, { value: 0.05, provenance: 'Mass', limit: true, label: 'C et al. 2022' }), /only an upper limit/u);
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
    'Ariel': { type: 'standard', title: 'Ariel', extract: 'Ariel is a spirit in The Tempest.', description: 'Character in a play', revision: 2, content_urls: { desktop: { page: 'https://en.wikipedia.org/wiki/Ariel' } } },
  };
  const archive = { exists: async (url: string) => decodeURIComponent(url.split('/').at(-1)!) in pages, text: async (url: string) => JSON.stringify(pages[decodeURIComponent(url.split('/').at(-1)!)]), bytes: async () => Buffer.alloc(0) };
  assert.equal(await wikipediaLead(archive, 'HD 219134 d'), undefined, 'no article');
  assert.equal(await wikipediaLead(archive, 'Mercury'), undefined, 'disambiguation');
  assert.equal(await wikipediaLead(archive, 'Ariel'), undefined, 'not a star or planet');
  assert.deepEqual(await wikipediaQuotes(archive, ['HD 219134 b', 'HD 219134'], ['HD 219134 b']), { url: 'https://en.wikipedia.org/wiki/HD_219134', title: 'HD 219134', revision: '1234',
    card: 'Smith et al. (2015) found HD 219134 b, a rocky planet with a 3.09-day orbit, transiting the star.' }, "a planet without its own article quotes its host's lead where it is named");
  assert.equal(await wikipediaQuotes(archive, ['HD 219134 c', 'HD 219134'], ['HD 219134 c']), undefined, "a planet name redirecting to a host lead that never names the planet gives it no quote");
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
