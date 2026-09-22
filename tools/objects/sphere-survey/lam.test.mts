import { sourceTest } from '../../../tests/objects/source-test.mts';
const test = sourceTest();
import assert from 'node:assert/strict';
import { framesUrl, parseFrameListing, shapeUrl, spinRecordName, surveyDirectory } from './lam.mts';

test('a listing yields every frame with its camera and start, whatever surrounds the time in its name', () => {
  const url = framesUrl(48, 'Doris'), html = [
    '<a href="?C=N;O=D">Name</a>', '<a href="/astero/Data/48Doris/">Parent</a>',
    '<a href="d48Doris_SPHER.2017-11-29T00_19_04.632_zpl_science_imaging_cam1.fits">x</a>',
    '<a href="d324Bamberga_2017-08-19T01_50_03.511__zpl_science_imaging_cam2.fits">x</a>',
    '<a href="d7Iris_2017-10-10T03_56_12.859_zpl_science_imaging_cam1.fits">x</a>',
    '<a href="readme.txt">x</a>'].join('\n');
  const frames = parseFrameListing(html, url);
  assert.deepEqual(frames.map(frame => [frame.second, frame.camera]), [['2017-08-19T01:50:03', 2], ['2017-10-10T03:56:12', 1], ['2017-11-29T00:19:04', 1]]);
  assert.equal(frames[2].start, '2017-11-29T00:19:04.632');
  assert.equal(frames[2].url, 'https://observations.lam.fr/astero/Data/48Doris/Deconv/d48Doris_SPHER.2017-11-29T00_19_04.632_zpl_science_imaging_cam1.fits');
});

test('survey names and the spin record are found as the release spells them', () => {
  assert.equal(surveyDirectory(52, 'Europa'), '52Europa');
  assert.equal(shapeUrl(7, 'Iris', 'adam'), 'https://observations.lam.fr/astero/3Dshape/7_Iris_adam.obj');
  const listing = '<a href="3_Juno_param.txt">a</a><a href="9_Metis_param">b</a><a href="7_Iris_adam.obj">c</a>';
  assert.equal(spinRecordName(listing, 3, 'Juno'), '3_Juno_param.txt');
  assert.equal(spinRecordName(listing, 9, 'Metis'), '9_Metis_param');
  assert.throws(() => spinRecordName(listing, 7, 'Iris'), /no spin record/);
});
