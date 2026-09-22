import assert from 'node:assert/strict';
import { sourceTest } from '../../tests/objects/source-test.mts';
const test = sourceTest();
import { aboutStar, candidateVerdict, fetchRetrying, readmeImageLines, readmeInterferometric, summariseOidb } from './star-candidates.mts';

// The CE Tauri deposit's ReadMe, abridged to the lines the reader parses (CDS J/A+A/614/A12).
const CE_TAU_README = `File Summary:
--------------------------------------------------------------------------------
 FileName      Lrecl  Records   Explanations
--------------------------------------------------------------------------------
ReadMe            80        .   This file
stel_par.dat     107        2   Stellar parameters compiled from Sect. 4.1.2 of
list.dat          97        4   List of fits images
fits/*             .        4   Individual fits images
--------------------------------------------------------------------------------

Byte-by-byte Description of file: stel_par.dat`;
const MOVIE_README = `File Summary:
 FileName    Lrecl    Records   Explanations
ReadMe          80          .   This file
list.dat        60          2   List of movies
alfsco1.gif    512      14393   Animated gif movie of reconstructed images

Byte-by-byte Description of file: list.dat`;



test('OiDB granules group by instrument, level, data PI and bibcode, most calibrated first, without single-telescope images', () => {
  const groups = summariseOidb([
    ['PIONIER', 2, 'MONTARGES', null, 57745.2, 'https://a/1.fits', 'VLTI'], ['PIONIER', 2, 'MONTARGES', null, 57706.1, 'https://a/2.fits', 'VLTI'],
    ['PIONIER', 3, 'Claudia Paladini', '2018Natur.553..310P', 56925.9, 'https://b/forImage.fits', 'VLTI'], ['AMBER', 0, '', null, 55060.2, 'https://c/raw', 'VLTI'],
    ['SPHERE', 3, 'Miguel Montargès', '2021Natur.594..365M', 59000, 'https://d/zimpol.fits', 'VLT']]);
  assert.deepEqual(groups.map(group => [group.instrument, group.calibrationLevel, group.granules]), [['PIONIER', 3, 1], ['PIONIER', 2, 2], ['AMBER', 0, 1]]);
  assert.equal(groups[1]!.firstMjd, 57706.1); assert.equal(groups[1]!.lastMjd, 57745.2);
});

test('a ReadMe that lists FITS images is a deposit; a movie, FITS spectra or FITS headers are not', () => {
  assert.deepEqual(readmeImageLines('File Summary:\nfits/*         .       137   Subdirectory containing the 137 FITS spectra\nmain.fih  80  294  associated FITS header\n\nByte-by-byte'), []);
  assert.deepEqual(readmeImageLines(CE_TAU_README), ['list.dat          97        4   List of fits images', 'fits/*             .        4   Individual fits images']);
  assert.deepEqual(readmeImageLines(MOVIE_README).filter(line => /fits?/iu.test(line)), []);
});

test('a paper is about the star when SIMBAD puts it in the title, or leaves the link unflagged on a paper naming few objects', () => {
  // Flags and object counts measured on SIMBAD: CE Tauri (151, 4 objects), Antares (407, 8), Polaris in its CHARA orbit paper
  // (155, 9); Polaris, Altair and Vega in the NPOI diameter surveys (128, 208, 160; 31 and 157 objects); π¹ Gruis in its
  // Nature paper, unflagged with 1 object; Vega unflagged in the 31-object survey.
  assert.deepEqual([[151, 4], [407, 8], [155, 9], [128, 31], [208, 31], [160, 157], [null, 1], [null, 31], [2, 1], [undefined, 1]].map(([flag, objects]) => aboutStar(flag, objects)),
    [true, true, true, false, false, false, true, false, false, false]);
});

test('a deposit counts for a star only when its paper is about it and its images are interferometric', () => {
  const header = 'J/A+A/614/A12  VLTI/PIONIER observations of CE Tauri (Montarges+, 2018)\nKeywords: stars: individual: CE Tau\n\nDescription:\n    Reconstructed images obtained with the SQUEEZE algorithm\n\nObjects:\n';
  assert.equal(readmeInterferometric(header), true);
  assert.equal(readmeInterferometric('J/A+A/699/A22  pi1 Gru SPHERE images\nAbstract:\n  observed with ALMA; the low gravity of AGB stars\n\nDescription:\n    Reduced VLT/SPHERE images (intensity/polarimetry)\n\nFile Summary:\n'), false);
});

test('the verdict follows the routes that worked: deposit, author calibration, raw calibration, automated calibration, shape only', () => {
  const level = (calibrationLevel: number, bibcode: string | null = null, instrument = 'PIONIER') => ({ instrument, calibrationLevel, dataPi: 'PI', bibcode, granules: 1, firstMjd: 0, lastMjd: 0, sampleUrl: '' });
  const none = new Set<string>();
  assert.equal(candidateVerdict([level(2)], [{ name: 'J/A+A/614/A12', title: 'CE Tau', bibcode: 'x', imageLines: ['fits/*'], aboutStar: true, interferometric: true }], none).route, 'published-image');
  assert.equal(candidateVerdict([level(2)], [{ name: 'J/A+A/671/A96', title: 'ATOMIUM SPHERE', bibcode: 'z', imageLines: ['fits/*'], aboutStar: true, interferometric: false }], none).route, 'automated-calibration', 'a SPHERE image is not a surface');
  const authored = candidateVerdict([level(3, '2018Natur.553..310P'), level(2)], [], new Set(['2018Natur.553..310P']));
  assert.equal(authored.route, 'author-calibrated');
  assert.match(authored.reason, /spotless-disc\.mts/u, 'an author-calibrated route names the artefact test a reconstruction must pass');
  assert.equal(candidateVerdict([level(3, '2018AJ....155...30B')], [], new Set(['2018Natur.553..310P'])).route, 'automated-calibration', 'a diameter survey is not an imaging paper');
  assert.equal(candidateVerdict([level(3)], [], none).route, 'automated-calibration', 'level-3 files with no paper');
  assert.equal(candidateVerdict([level(2)], [{ name: 'J/A+A/555/A24', title: 'Antares', bibcode: 'y', imageLines: [], aboutStar: true, interferometric: true }], none).route, 'automated-calibration');
  const raw = candidateVerdict([level(2), level(0, null, 'MATISSE')], [], none);
  assert.equal(raw.route, 'raw-calibration', 'public raw VLTI frames outrank an automated calibration');
  assert.match(raw.reason, /MATISSE frames/u);
  assert.equal(candidateVerdict([level(0, null, 'MIRC-X')], [], none).route, 'shape-only', 'raw frames the tools cannot calibrate');
});

test('a dropped connection is retried, and the last failure is reported', async () => {
  let calls = 0;
  const flaky = (async () => { calls++; if (calls < 3) throw new TypeError('fetch failed'); return new Response('ok'); }) as typeof fetch;
  assert.equal(await (await fetchRetrying('https://example.org/', 3, flaky)).text(), 'ok');
  assert.equal(calls, 3);
  await assert.rejects(fetchRetrying('https://example.org/', 2, (async () => { throw new TypeError('fetch failed'); }) as typeof fetch), /fetch failed/u);
});
