/** The surface gravity a star's limb is read at when its mass is unmeasured (gravity.mts), offline. */
import assert from 'node:assert/strict';
import { sourceTest } from '@cssearth/objects/node/source-test';
import type { Archive } from './archives.mts';
import { chooseGravity, choosePublished, SURVEY_PIPELINES } from './gravity.mts';

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
const archive = (simbad: string): Archive => ({
  async text(url) { return url.includes('simbad') ? simbad : grid; },
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
