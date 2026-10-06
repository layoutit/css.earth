import assert from 'node:assert/strict';
import test from 'node:test';
import { methodFor, parseAnalysis, REINHOLD_HEKKER_2020, type RotationAnalysis } from './methods.mts';

/** K2-100 in campaign 5, as tools.py measured it. */
const analysis: RotationAnalysis = { spanDays: 74.8, variabilityRange: 0.0142, peakHeight: 0.349, lombScargleDays: 4.251, waveletDays: 4.255, autocorrelationDays: 4.25, starPrivateer: '1.3.1', time: [0, 0.125], flux: [1, 1] };
const dwarf = { effectiveTemperatureK: 5945, surfaceGravityLogg: 4.38 };

test('a star is given the published method made for its kind, or the paper\'s reason it has none', () => {
  assert.deepEqual(methodFor('K2', dwarf), { method: REINHOLD_HEKKER_2020 });
  const giant = methodFor('K2', { effectiveTemperatureK: 4800, surfaceGravityLogg: 2.6 }); assert.ok('reason' in giant); assert.match(giant.reason, /log g 2\.6 the star is evolved: Reinhold & Hekker \(2020\) apply their method to stars with log g over 4\.2/u);
  const hot = methodFor('K2', { effectiveTemperatureK: 7200, surfaceGravityLogg: 4.3 }); assert.ok('reason' in hot); assert.match(hot.reason, /At 7200 K the star is outside the 3250 to 6250 K/u);
  const unknown = methodFor('K2', {}); assert.ok('reason' in unknown); assert.match(unknown.reason, /holds no temperature or no surface gravity/u);
  // No paper read yet prints criteria for one Kepler quarter or one TESS sector.
  for (const mission of ['Kepler', 'TESS'] as const) { const none = methodFor(mission, dwarf); assert.ok('reason' in none); assert.match(none.reason, /No published method is wired here/u); }
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
});
