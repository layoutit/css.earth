import assert from 'node:assert/strict';
import { sourceTest } from '../objects/source-test.mts';
const test = sourceTest();
import { checkGaiaCepheidModel, gaiaCepheidQuery, gaiaMagnitude, GAIA_TIME_OFFSET_JD, linearToSrgb, parseGaiaCepheidRow, pulsationTrack, PULSATION_SECONDS_PER_DAY } from '@cssearth/bake/photometry';

// S Vul's row as the Gaia archive returns it to gaiaCepheidQuery('2027971514401523456') (gaiadr3.vari_cepheid).
const header = 'source_id,pf,pf_error,fund_freq1,reference_time_g,zp_mag_g,num_harmonics_for_p1_g,fund_freq1_harmonic_ampl_g,fund_freq1_harmonic_phase_g,epoch_g,epoch_g_error,peak_to_peak_g,r21_g,phi21_g,mode_best_classification';
const nan = (count: number) => Array(count).fill('NaN').join(', '), zero = (count: number) => Array(count).fill('0.0').join(', ');
const row = (overrides: Partial<Record<string, string>> = {}) => {
  const values: Record<string, string> = { source_id: '2027971514401523456', pf: '69.467416955503', pf_error: '0.04627568', fund_freq1: '0.014395237995397827',
    reference_time_g: '1796.4225877192143', zp_mag_g: '8.083196', num_harmonics_for_p1_g: '2',
    fund_freq1_harmonic_ampl_g: `"(0.19668083, 0.04891441, ${nan(14)})"`, fund_freq1_harmonic_phase_g: `"(5.454763, 3.7024179, ${zero(14)})"`,
    epoch_g: '1626.505285846054', epoch_g_error: '0.06544369', peak_to_peak_g: '0.42478037', r21_g: '0.24869943', phi21_g: '5.3592625', mode_best_classification: 'FUNDAMENTAL', ...overrides };
  return `${header}\n${header.split(',').map(name => values[name]).join(',')}\n`;
};
const SCENE_JD = 2461286.5;

test('the query selects the columns the reader needs, for one numeric source', () => {
  assert.match(gaiaCepheidQuery('2027971514401523456'), /FROM gaiadr3\.vari_cepheid WHERE source_id = 2027971514401523456$/u);
  assert.throws(() => gaiaCepheidQuery('1; DROP'), /digits/u);
});

test("Gaia's harmonics, read as a cosine series from reference_time_g, reproduce the same row's epoch, range and ratios", () => {
  const model = parseGaiaCepheidRow(row(), 's-vul');
  assert.equal(model.amplitudesMag.length, 2);
  const check = checkGaiaCepheidModel(model, 's-vul');
  assert.ok(Math.abs(check.peakToPeakMag - 0.42478037) < 1e-6);
  assert.ok(Math.abs(check.maximumTime - 1626.505285846054) < 0.01, `maximum at ${check.maximumTime}`);
  assert.ok(Math.abs(gaiaMagnitude(model, check.maximumTime) - check.brightestMag) < 1e-12);
});

test('a reading with the other phase sign misses the epoch of maximum and is refused', () => {
  // cos(x - phi) is cos(x + (2 pi - phi)): the same numbers read with the wrong sign peak 7.5 days away.
  const flipped = row({ fund_freq1_harmonic_phase_g: `"(${2 * Math.PI - 5.454763}, ${2 * Math.PI - 3.7024179}, ${zero(14)})"` });
  assert.throws(() => checkGaiaCepheidModel(parseGaiaCepheidRow(flipped, 's-vul flipped'), 's-vul flipped'), /s-vul flipped: the model peaks at .* from epoch_g/u);
});

test('rows the reader cannot play are refused with the file named', () => {
  assert.throws(() => parseGaiaCepheidRow(row({ mode_best_classification: 'FIRST_OVERTONE' }), 'x.csv'), /x\.csv: mode_best_classification is "FIRST_OVERTONE"/u);
  assert.throws(() => parseGaiaCepheidRow(row({ num_harmonics_for_p1_g: '3' }), 'x.csv'), /x\.csv: the first 3 harmonic amplitudes must be finite/u);
  assert.throws(() => parseGaiaCepheidRow(row({ fund_freq1: '0.02' }), 'x.csv'), /x\.csv: pf 69\.467416955503 d and fund_freq1 0\.02 \/d disagree/u);
  assert.throws(() => checkGaiaCepheidModel(parseGaiaCepheidRow(row({ peak_to_peak_g: '0.5' }), 'x.csv'), 'x.csv'), /x\.csv: the harmonic model spans 0\.42478 mag but peak_to_peak_g is 0\.5/u);
});

test('the veil plays one period from the scene epoch and dims a white pixel to the flux ratio', () => {
  const model = parseGaiaCepheidRow(row(), 's-vul'), check = checkGaiaCepheidModel(model, 's-vul');
  const track = pulsationTrack(model, check, SCENE_JD, 'photometry/gaia-dr3-vari-cepheid.csv', 's-vul');
  assert.equal(track.durationMs, Math.round(69.467416955503 * PULSATION_SECONDS_PER_DAY * 1000));
  assert.equal(track.keyframes[0]!.offset, 0); assert.equal(track.keyframes.at(-1)!.offset, 1);
  assert.equal(track.keyframes[0]!.opacity, track.keyframes.at(-1)!.opacity, 'the loop closes');
  const sceneTime = SCENE_JD - GAIA_TIME_OFFSET_JD;
  for (const frame of track.keyframes) {
    const flux = 10 ** (-0.4 * (gaiaMagnitude(model, sceneTime + frame.offset * model.periodDays) - check.brightestMag));
    // Under a veil of this opacity a white pixel decodes to the model's flux ratio.
    assert.ok(Math.abs((1 - Number(frame.opacity)) - linearToSrgb(flux) / 255) <= 5e-5, `offset ${frame.offset}`);
  }
  const deepest = Math.max(...track.keyframes.map(frame => Number(frame.opacity)));
  assert.ok(Math.abs(deepest - (1 - linearToSrgb(10 ** (-0.4 * check.peakToPeakMag)) / 255)) < 2e-3);
  assert.ok(track.provenance.phaseAtSceneEpoch >= 0 && track.provenance.phaseAtSceneEpoch < 1);
  assert.throws(() => pulsationTrack(model, check, Number.NaN, 'p', 's-vul'), /s-vul: the scene epoch must be a finite Julian date/u);
});
