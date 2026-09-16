import assert from 'node:assert/strict';
import { test } from 'node:test';
import { aboutStar, candidateVerdict, readmeImageLines, readmeInterferometric, summariseOidb, tapUrl } from './star-candidates.mts';

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

test('a query is sent as an encoded ADQL request for JSON', () => {
  assert.equal(tapUrl('https://example.org/tap/sync', "SELECT * FROM t WHERE id = 'a b'"), 'https://example.org/tap/sync?REQUEST=doQuery&LANG=ADQL&FORMAT=json&QUERY=SELECT%20*%20FROM%20t%20WHERE%20id%20%3D%20\'a%20b\'');
});

test('OiDB granules group by instrument, level, data PI and bibcode, most calibrated first', () => {
  const groups = summariseOidb([
    ['PIONIER', 2, 'MONTARGES', null, 57745.2, 'https://a/1.fits'], ['PIONIER', 2, 'MONTARGES', null, 57706.1, 'https://a/2.fits'],
    ['PIONIER', 3, 'Claudia Paladini', '2018Natur.553..310P', 56925.9, 'https://b/forImage.fits'], ['AMBER', 0, '', null, 55060.2, 'https://c/raw']]);
  assert.deepEqual(groups.map(group => [group.instrument, group.calibrationLevel, group.granules]), [['PIONIER', 3, 1], ['PIONIER', 2, 2], ['AMBER', 0, 1]]);
  assert.equal(groups[1]!.firstMjd, 57706.1); assert.equal(groups[1]!.lastMjd, 57745.2);
});

test('a ReadMe that lists FITS images is a deposit; a movie, FITS spectra or FITS headers are not', () => {
  assert.deepEqual(readmeImageLines('File Summary:\nfits/*         .       137   Subdirectory containing the 137 FITS spectra\nmain.fih  80  294  associated FITS header\n\nByte-by-byte'), []);
  assert.deepEqual(readmeImageLines(CE_TAU_README), ['list.dat          97        4   List of fits images', 'fits/*             .        4   Individual fits images']);
  assert.deepEqual(readmeImageLines(MOVIE_README).filter(line => /fits?/iu.test(line)), []);
});

test('a deposit counts for a star only when SIMBAD flags the paper as about it and its images are interferometric', () => {
  const header = 'J/A+A/614/A12  VLTI/PIONIER observations of CE Tauri (Montarges+, 2018)\nKeywords: stars: individual: CE Tau\n\nDescription:\n    Reconstructed images obtained with the SQUEEZE algorithm\n\nObjects:\n';
  // SIMBAD flags measured on the papers: CE Tauri in Montargès et al. 2018 (151) and Antares in Ohnaka et al. 2013 (407) are about
  // the star; Antares mentioned in the CE Tauri paper (128) and in an Ophiuchus core catalogue (128) is not.
  assert.deepEqual([151, 407, 128, 224, null].map(aboutStar), [true, true, false, false, false]);
  assert.equal(readmeInterferometric(header), true);
  assert.equal(readmeInterferometric('J/A+A/699/A22  pi1 Gru SPHERE images\nAbstract:\n  observed with ALMA; the low gravity of AGB stars\n\nDescription:\n    Reduced VLT/SPHERE images (intensity/polarimetry)\n\nFile Summary:\n'), false);
});

test('the verdict follows the routes that worked: deposit, author calibration, automated calibration, shape only', () => {
  const level = (calibrationLevel: number) => ({ instrument: 'PIONIER', calibrationLevel, dataPi: 'PI', bibcode: null, granules: 1, firstMjd: 0, lastMjd: 0, sampleUrl: '' });
  assert.equal(candidateVerdict([level(2)], [{ name: 'J/A+A/614/A12', title: 'CE Tau', bibcode: 'x', imageLines: ['fits/*'], aboutStar: true, interferometric: true }]).route, 'published-image');
  assert.equal(candidateVerdict([level(2)], [{ name: 'J/A+A/671/A96', title: 'ATOMIUM SPHERE', bibcode: 'z', imageLines: ['fits/*'], aboutStar: true, interferometric: false }]).route, 'automated-calibration', 'a SPHERE image is not a surface');
  assert.equal(candidateVerdict([level(3), level(2)], []).route, 'author-calibrated');
  assert.equal(candidateVerdict([level(2)], [{ name: 'J/A+A/555/A24', title: 'Antares', bibcode: 'y', imageLines: [], aboutStar: true, interferometric: true }]).route, 'automated-calibration');
  assert.equal(candidateVerdict([level(0)], []).route, 'shape-only');
});
