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
  const build = async (extra: Record<string, unknown>) => {
    const spec = parseStarSpec({ ...star, planets: [{ id: 'hd-219134b', name: 'HD 219134 b', description: 'A planet.', paper: star.paper, radius: cited, mass: cited, orbit: { elements: { periodDays: 3, semiMajorAxisStellarRadii: 9, inclinationDegrees: 88, eccentricity: 0, transitTimeBmjdTdb: 59000 }, source: 's', url: star.paper.url }, ...extra }] }).planets[0]!;
    const body = { id: spec.id, classification: 'exoplanet', order: 2, physical: { name: spec.name, horizonsCode: null, meanRadiusKm: 71492, gravitationalParameterKm3PerS2: 126686531.9, parent: 'hd-219134' }, physicalNotes: 'n', hostedOrbit: orbit };
    const record = { spec, hostId: 'hd-219134', system: 'HD 219134 system', body, order: 2, orbit, orbitCitation: { text: 's', url: star.paper.url, label: 's' }, radius: cited, mass: cited, documents: new Map<string, string>(), todo: [] };
    const { files } = await hostedPackage(record, host, new Map([[star.paper.url, paper]]), archive, root, 2460000);
    const text = JSON.parse(String(files.get('src/objects/hd-219134b/text.json'))), content = JSON.parse(String(files.get('src/objects/hd-219134b/source/content/object.json')));
    return { datasets: Object.keys(text.datasets), notes: String(content.lenses.controls[0].notes), lens: String(content.lenses.controls[0].id) };
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
  const ps = ['pl_name,pl_refname,default_flag,pl_orbper,pl_ratdor,pl_orbincl,pl_orbeccen,pl_orblper,pl_tranmid,pl_radj,pl_bmassj,pl_orbsmax,st_rad,st_mass,pl_bmassjlim',
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
});

test('ids follow one rule, and a body the universe holds is found whatever its id', async () => {
  const { hostId, planetId, planetPrefix, duplicateName, duplicateStar, existingBodies } = await import('./identity.mts');
  assert.equal(hostId({ planetPrefix: planetPrefix('pi Men c', 'c'), hostname: 'HD 39091' }), 'pi-men', 'the name its planets use');
  assert.equal(hostId({ hostname: '55 Cnc', hd: 'HD 75732' }), 'hd-75732', 'a name starting with a digit falls to its HD name');
  assert.equal(hostId({ hostname: 'Kepler-444' }), 'kepler-444');
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
  assert.deepEqual([star.id, star.name, star.system, star.gaia, star.temperature.value, star.temperature.uncertainty, star.radius.value, star.mass.value], ['hd-233731b', 'HD 233731B', 'HAT-P-22 system', '846946625690867328', 3589, 157, 0.599, 0.587]);
  assert.match(star.temperature.source, /TIC 252479261/u);
  assert.doesNotThrow(() => parseStarSpec(star), 'the draft is a valid star spec');
  const held = await wideCompanions(archive, { gaia: '846946621395854848', name: 'HAT-P-22', system: 's' }, () => 'hd-233731-b');
  assert.deepEqual([held.companions.length, /already in the universe as hd-233731-b/u.test(held.notes[0]!)], [0, true]);
  // A circumbinary host: the pair's orbit is a paper's, so the draft refuses it.
  const cb = { async text(url: string) { if (decodeURIComponent(url).includes('st_teff')) return 'pl_name,hostname,default_flag,pl_refname,st_refname,st_rad,st_raderr1,st_teff,st_tefferr1,st_mass,st_masserr1,sy_dist,disc_year,discoverymethod,tran_flag,pl_letter,hd_name,hip_name,gaia_dr3_id,cb_flag,sy_snum\nTOI-1338 b,TOI-1338,1,x,x,1,,5990,,1,,400,2020,Transit,1,b,,,Gaia DR3 1,1,2'; throw new Error('unexpected'); }, async bytes() { throw new Error('none'); }, async exists() { return false; } };
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
