/** The surface gravity a star's limb is read at when its mass is unmeasured (gravity.mts), offline. */
import assert from 'node:assert/strict';
import { sourceTest } from '@cssearth/objects/node/source-test';
import type { Archive } from './archives.mts';
import { chooseGravity, choosePublished, citedGravity, impliedMassSolar, PHOTOMETRIC_GRAVITIES, SURVEY_PIPELINES } from './gravity.mts';

const test = sourceTest();
const range = { min: -1.33, max: 2.86, source: 'Luck (2018), AJ 156, 171, table 3', url: 'https://vizier.cds.unistra.fr/viz-bin/VizieR?-source=J/AJ/156/171/table3' };
const row = (logg: number, bibcode: string) => ({ logg, bibcode, title: bibcode });

test("a star's own analysis comes before a survey pipeline; the most recent paper gives the median of its spectra", () => {
  const rows = [row(1.26, '2011AJ....142..136L'), row(0.9, '2023A&A...678A.195D'), row(1.8, '2023A&A...678A.195D'), row(1.1, '2023A&A...678A.195D'), row(1.7, '2022AJ....163..152S')];
  assert.ok('2022AJ....163..152S' in SURVEY_PIPELINES);
  assert.deepEqual(choosePublished(rows), { logg: 1.1, bibcode: '2023A&A...678A.195D', title: '2023A&A...678A.195D', measurements: 3, survey: false });
  assert.equal(choosePublished([row(1.7, '2022AJ....163..152S')])?.survey, true, 'a survey value is used when it is the only one');
  assert.equal(choosePublished([row(3.4, '2022AJ....163..152S')], range), null, "a value outside the class's range is not used");
});

// A grid whose u1 falls with log g, so the law closest to all others sits mid-range.
const grid = ['logg\tTeff\tZ\txi\ta\tb\tFilt\tMet\tMod', '[cm/s2]\tK\t[Sun]\tkm/s\t\t\t\t\t', '-----\t-----\t-----\t-----\t-----\t-----\t-----\t-----\t-----', ...[5000, 6000].flatMap(teff => [0, 1, 2, 3].map(logg => `${logg}\t${teff}\t0\t2\t${(0.7 - 0.05 * logg).toFixed(3)}\t0.1\tV\tL\tA`))].join('\n');
// The two photometric tables answer with `photometric` (by default no row); every other VizieR request is the limb grid.
const archive = (simbad: string, photometric: Readonly<Record<string, string>> = {}): Archive => ({
  async text(url, form) { const table = String((form as Record<string, string> | undefined)?.['-source'] ?? ''); return url.includes('simbad') ? simbad : PHOTOMETRIC_GRAVITIES.some(paper => paper.table === table) ? photometric[table] ?? '' : grid; },
  async bytes() { throw new Error('offline'); }, async exists() { return false; },
});

test('with nothing published, the limb is read at the gravity closest to every law in the range, and the bound is recorded', async () => {
  const choice = await chooseGravity({ archive: archive('main_id\tlog_g\tbibcode\ttitle\n'), ra: 0, dec: 0, teffK: 5500, range, where: 'test' });
  assert.equal(choice?.kind, 'bounded');
  // The grid reaches log g 0 to 3; inside the cited range that is 0 to 2.85, and the law at its middle is closest to both ends.
  assert.deepEqual(choice?.span, [0, 2.85]);
  assert.ok(Math.abs(choice!.logg - 1.425) <= 0.05, `drawn at ${choice?.logg}`);
  assert.ok(Math.abs(choice!.spread - 0.05 * 1.425) < 0.004, `spread ${choice?.spread}`);
  assert.match(choice!.sentence, /is a display choice, not a measurement$/u);
  assert.equal(await chooseGravity({ archive: archive('main_id\tlog_g\tbibcode\ttitle\n'), ra: 0, dec: 0, teffK: 5500, where: 'test' }), null, 'no range, no limb');
});

test('a published value is used as a fact, with the spread of laws across every published value', async () => {
  const simbad = 'main_id\tlog_g\tbibcode\ttitle\n"V* X"\t1.0\t"2023A&A...678A.195D"\t"Cepheids"\n"V* X"\t2.0\t"2011AJ....142..136L"\t"Cepheids"\n';
  const choice = await chooseGravity({ archive: archive(simbad), ra: 0, dec: 0, teffK: 5500, range, where: 'test' });
  assert.equal(choice?.kind, 'published'); assert.equal(choice?.logg, 1);
  assert.deepEqual(choice?.span, [1, 2]); assert.ok(Math.abs(choice!.spread - 0.05) < 1e-9);
  // A survey's value names its pipeline; the paper that compares pipelines is named as what it is.
  const survey = async (bibcode: string) => (await chooseGravity({ archive: archive(`main_id\tlog_g\tbibcode\ttitle\n"V* X"\t1.0\t"${bibcode}"\t"T"\n`), ra: 0, dec: 0, teffK: 5500, where: 'test' }))?.source;
  assert.equal(await survey('2013AJ....146..134K'), '2013AJ....146..134K ("T"), the RAVE DR4 pipeline');
  assert.equal(await survey('2022A&A...663A...4S'), '2022A&A...663A...4S ("T"), a comparison of survey pipelines (Soubiran et al. 2022)');
  const twoStars = 'main_id\tlog_g\tbibcode\ttitle\n"A"\t1\t"b"\t"t"\n"B"\t1\t"b"\t"t"\n';
  await assert.rejects(chooseGravity({ archive: archive(twoStars), ra: 0, dec: 0, teffK: 5500, range, where: 'test' }), /test: SIMBAD holds gravities for A and B within 1 arcsecond/u);
});

test('a published gravity that would make the star more massive than any star contradicts its radius and is not used', async () => {
  // Beta Gruis: a giant of 153.871 solar radii whose one published value is log g 3.47.
  assert.equal(Math.round(impliedMassSolar(3.47, 153.871)), 2548);
  assert.ok(Math.abs(impliedMassSolar(4.4381, 1) - 1) < 1e-3, 'the Sun weighs one solar mass');
  const library = 'main_id\tlog_g\tbibcode\ttitle\n"* bet Gru"\t3.47\t"2023ApJS..266...11B"\t"A library"\n';
  let reason: string | undefined;
  assert.equal(await chooseGravity({ archive: archive(library), ra: 0, dec: 0, teffK: 5500, where: 'test', radiusSolar: 153.871, contradicted: sentence => { reason = sentence; } }), null);
  assert.equal(reason, 'the published gravity, log g 3.47 (2023ApJS..266...11B), would give this star of 153.9 solar radii 2,548 solar masses or more, above the 320 that Crowther et al. (2010) infer for the most massive star, so it contradicts the radius and is not used');
  // The same value on a star it fits is used, and a second, consistent value is chosen when one contradicts.
  reason = undefined;
  assert.equal((await chooseGravity({ archive: archive(library), ra: 0, dec: 0, teffK: 5500, where: 'test', radiusSolar: 3, contradicted: sentence => { reason = sentence; } }))?.logg, 3.47);
  const both = `${library}"* bet Gru"\t1.0\t"2011AJ....142..136L"\t"A paper"\n`;
  assert.equal((await chooseGravity({ archive: archive(both), ra: 0, dec: 0, teffK: 5500, where: 'test', radiusSolar: 153.871, contradicted: sentence => { reason = sentence; } }))?.logg, 1);
  assert.equal(reason, undefined);
});

test("a star with no spectroscopic gravity takes the one measured from its photometry, the most recent paper's", async () => {
  const none = 'main_id\tlog_g\tbibcode\ttitle\n';
  // Gienah (HD 106625) and Alnair (HD 209952) in David & Hillenbrand (2015), table 5; Kaus Australis (HD 169022) in Philip & Egret (1980). Rows as VizieR gives them.
  const table5 = (logg: string) => ['#RESOURCE=yCat_18040146', 'log(g)\te_log(g)', '[cm/s2]\t[cm/s2]', '-----\t-----', `${logg}\t 0.14`].join('\n');
  const uvby = (logg: string) => ['log.g', '[cm/s2]', '-----', logg].join('\n');
  const gienah = await chooseGravity({ archive: archive(none, { 'J/ApJ/804/146/table5': table5(' 3.44'), 'V/14/catalog': uvby('     ') }), ra: 183.95154, dec: -17.54193, teffK: 5500, where: 'gienah', radiusSolar: 3.8 });
  assert.equal(gienah?.kind, 'published');
  assert.equal(gienah?.logg, 3.44);
  assert.equal(gienah?.sentence, "log g 3.44 +/- 0.14 from 2015ApJ...804..146D, measured from the star's Stroemgren photometry: SIMBAD's compilation holds no spectroscopic gravity of this star");
  assert.match(citedGravity(gienah!).source, /^A gravity measured from the star's Stroemgren photometry \(VizieR J\/ApJ\/804\/146\/table5\): log g 3\.44/u);
  const kaus = await chooseGravity({ archive: archive(none, { 'V/14/catalog': uvby(' 3.57') }), ra: 276.04299, dec: -34.38462, teffK: 5500, where: 'kaus-australis' });
  assert.equal(kaus?.logg, 3.57);
  assert.match(kaus!.sentence, /^log g 3\.57 from 1980A&AS\.\.\.40\.\.199P, measured/u);
  // A spectroscopic value comes first: Alnair's 3.84, not the photometric 4.00.
  const alnair = await chooseGravity({ archive: archive(`${none}"* alf Gru"\t3.84\t"2003AJ....125.1598L"\t"A paper"\n`, { 'J/ApJ/804/146/table5': table5(' 4.00') }), ra: 332.05827, dec: -46.96097, teffK: 5500, where: 'alnair' });
  assert.equal(alnair?.logg, 3.84);
  assert.equal(alnair?.compilation, undefined);
  // A class range comes first too: the star keeps the display gravity it was drawn at before this stage existed.
  assert.equal((await chooseGravity({ archive: archive(none, { 'V/14/catalog': uvby(' 2.00') }), ra: 0, dec: 0, teffK: 5500, range, where: 'test' }))?.kind, 'bounded');
});
