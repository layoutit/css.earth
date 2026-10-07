import assert from 'node:assert/strict';
import test from 'node:test';
import { HOLCOMB_2022, holcombStar, methodFor, parseAnalysis, parseMissionLightCurve, REINHOLD_HEKKER_2020, type RotationAnalysis } from './methods.mts';

/** K2-100 in campaign 5, as tools.py measured it. */
const analysis: RotationAnalysis = { spanDays: 74.8, variabilityRange: 0.0142, peakHeight: 0.349, lombScargleDays: 4.251, waveletDays: 4.255, autocorrelationDays: 4.25, starPrivateer: '1.3.1', time: [0, 0.125], flux: [1, 1] };
const dwarf = { effectiveTemperatureK: 5945, surfaceGravityLogg: 4.38 };

test('a star is given the published method made for its kind, or the paper\'s reason it has none', () => {
  assert.deepEqual(methodFor('K2', dwarf), { method: REINHOLD_HEKKER_2020 });
  const giant = methodFor('K2', { effectiveTemperatureK: 4800, surfaceGravityLogg: 2.6 }); assert.ok('reason' in giant); assert.match(giant.reason, /log g 2\.6 the star is evolved: Reinhold & Hekker \(2020\) apply their method to stars with log g over 4\.2/u);
  const hot = methodFor('K2', { effectiveTemperatureK: 7200, surfaceGravityLogg: 4.3 }); assert.ok('reason' in hot); assert.match(hot.reason, /At 7200 K the star is outside the 3250 to 6250 K/u);
  const unknown = methodFor('K2', {}); assert.ok('reason' in unknown); assert.match(unknown.reason, /holds no temperature or no surface gravity/u);
  // A TESS 2-minute light curve is judged by Holcomb et al. (2022), for dwarfs by the cuts they print.
  assert.deepEqual(methodFor('TESS', dwarf), { method: HOLCOMB_2022 });
  for (const [temperature, gravity, fits] of [[6100, 3.6, true], [6100, 3.4, false], [4000, 4.1, true], [4000, 3.9, false], [5000, 3.9, true], [5000, 3.7, false]] as const) assert.equal(HOLCOMB_2022.outside({ effectiveTemperatureK: temperature, surfaceGravityLogg: gravity }) === undefined, fits);
  assert.match(HOLCOMB_2022.outside({ effectiveTemperatureK: 5000, surfaceGravityLogg: 3.7 })!, /log g 3\.7 at 5000 K the star is not a dwarf.*at least 3\.8 at that temperature/u); assert.match(HOLCOMB_2022.outside({})!, /leave such stars out/u);
  // The paper analyses campaigns 0 to 18 without campaign 9.
  assert.equal(REINHOLD_HEKKER_2020.covers(13), undefined); assert.match(REINHOLD_HEKKER_2020.covers(9)!, /campaigns 0 to 18 without campaign 9, not campaign 9/u); assert.match(REINHOLD_HEKKER_2020.covers(19)!, /not campaign 19/u);
});

test('a star observed in several campaigns is given the mean of their periods, or excluded when they deviate by over 20%', () => {
  const seen = (periodDays: number, amplitude: number) => ({ detected: true, periodDays, amplitude }), none = { detected: false, reason: 'The periodogram\'s highest peak is too low.' };
  assert.deepEqual(REINHOLD_HEKKER_2020.star([seen(14.5, 0.006)]), seen(14.5, 0.006)); assert.deepEqual(REINHOLD_HEKKER_2020.star([none]), none);
  // A campaign that fails the criteria is left out of the mean; the variability is the mean of the campaigns'.
  assert.deepEqual(REINHOLD_HEKKER_2020.star([seen(10, 0.01), none, seen(11, 0.02)]), { detected: true, periodDays: 10.5, amplitude: 0.015 });
  assert.match(REINHOLD_HEKKER_2020.star([seen(10, 0.01), seen(13, 0.01)]).reason!, /periods of 10 and 13 d, which deviate by more than the 20%/u);
});

test('Reinhold & Hekker\'s criteria are applied as their Sect. 3 prints them', () => {
  const judge = (changed: Partial<RotationAnalysis>) => REINHOLD_HEKKER_2020.verdict({ ...analysis, ...changed });
  // The period is the mean of the three methods' periods; the swing is the paper's variability range.
  assert.deepEqual(judge({}), { detected: true, periodDays: 4.25, amplitude: 0.0142 });
  assert.match(judge({ peakHeight: 0.3 }).reason!, /height of 0\.30, not over the 0\.3/u);
  // Under 10 days the three periods may differ by a day; from 10 to 20 by two; beyond by five.
  assert.match(judge({ waveletDays: 5.3 }).reason!, /do not agree within the 1 d they allow at this period: 4\.25 d \(periodogram\), 5\.30 d \(wavelet\) and 4\.25 d \(autocorrelation\)/u);
  assert.equal(judge({ lombScargleDays: 15, waveletDays: 14.63, autocorrelationDays: 13.88 }).periodDays, 14.5); assert.match(judge({ lombScargleDays: 15, waveletDays: 14.63, autocorrelationDays: 12.9 }).reason!, /within the 2 d/u);
  assert.equal(judge({ lombScargleDays: 33, waveletDays: 30, autocorrelationDays: 35 }).periodDays, 32.67);
  // Longer than a day and shorter than half the light's time span.
  assert.match(judge({ lombScargleDays: 0.8, waveletDays: 0.8, autocorrelationDays: 0.8 }).reason!, /outside the range/u); assert.match(judge({ lombScargleDays: 38, waveletDays: 38, autocorrelationDays: 38 }).reason!, /shorter than half the 75 days/u);
  assert.match(judge({ variabilityRange: 0.12 }).reason!, /varies by 12%, over the 10%/u);
});

test('what the tool printed is read whole or refused', () => {
  assert.equal(parseAnalysis({ ...analysis }).waveletDays, 4.255);
  assert.throws(() => parseAnalysis({ ...analysis, flux: [1] }), /different lengths/u); assert.throws(() => parseAnalysis({ ...analysis, peakHeight: 'high' }), /peakHeight/u);
  assert.deepEqual(parseMissionLightCurve({ frames: 2, window: 13, pipeline: 'r63269', time: [2987.6, 2987.62], flux: [1, 1.001] }).window, 13); assert.throws(() => parseMissionLightCurve({ frames: 1, window: 13, pipeline: '', time: [1], flux: [1] }), /or none/u);
});

test('Holcomb et al.\'s rule for a star is applied as their Sect. III prints it', () => {
  const spin = (periodDays: number, height: number, width: number, fit: number, centre = 0.001) => ({ periodDays, height, width, fit, centre, range: 0.05 });
  const judged = (one: ReturnType<typeof spin>) => ({ spin: one, verdict: one.height / one.width > 0.25 && one.width > 0.4 && one.width < 0.6 && one.fit > 0.9 ? { detected: true, periodDays: one.periodDays, amplitude: one.range } : { detected: false, reason: 'outside' } });
  // AU Mic: sectors 1 and 95 pass, sector 27's peaks are too narrow, and the three together pass: two of three is at least half.
  const sectors = [judged(spin(4.97, 0.34, 0.41, 0.97)), judged(spin(4.89, 0.38, 0.38, 0.97)), judged(spin(5.0, 0.31, 0.42, 0.95))], whole = judged(spin(4.84, 0.32, 0.43, 0.98));
  assert.deepEqual(holcombStar(sectors, whole), { detected: true, periodDays: 4.84, amplitude: 0.05 });
  // One valid sector of three is under half; a stitched light curve that fails refuses the star; a lopsided light is a possible eclipsing binary.
  assert.match(holcombStar([sectors[0]!, sectors[1]!, sectors[1]!], whole).reason!, /in 1 of the star's 3 sectors, and Holcomb et al\. \(2022\) ask for at least 2/u);
  assert.match(holcombStar(sectors, judged(spin(4.84, 0.32, 0.7, 0.98))).reason!, /sectors together do not give a valid period/u);
  assert.match(holcombStar(sectors, judged(spin(4.84, 0.32, 0.43, 0.98, 0.013))).reason!, /lopsided.*0\.013.*possible eclipsing binary/u);
  // A star with one sector is judged on it alone.
  assert.equal(holcombStar([sectors[0]!], undefined).periodDays, 4.97); assert.equal(holcombStar([sectors[1]!], undefined).detected, false);
});
