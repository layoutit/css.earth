import assert from 'node:assert/strict';
import { test } from 'node:test';
import { parseLightCurve, SKY_TERMS } from './photometry.mts';

const peak = { periodDays: 3.88, power: 0.85, amplitude: 0.031 };
const printed = { frames: 3600, aperturePixels: 21, saturated: false, spanDays: 26.6, scatter: 0.011, whole: peak, halves: [{ ...peak, periodDays: 3.76 }, null], time: [1, 2, 3], flux: [1.01, 0.99, 1] };

test('the light curve the pinned codes print is read with its period in the sector and in each orbit', () => {
  assert.equal(SKY_TERMS, 2);
  const curve = parseLightCurve(printed)!;
  assert.deepEqual([curve.whole.periodDays, curve.halves[0]?.periodDays, curve.halves[1]], [3.88, 3.76, null]);
  assert.deepEqual([curve.frames, curve.aperturePixels, curve.saturated, curve.time.length], [3600, 21, false, 3]);
});

test('a star no pixel shows gives no light curve, and a broken answer is refused', () => {
  assert.equal(parseLightCurve({ frames: 3600, aperturePixels: 0 }), undefined);
  assert.throws(() => parseLightCurve({ ...printed, flux: [1, 2] }), /different lengths/u);
  assert.throws(() => parseLightCurve({ ...printed, whole: { periodDays: 'x' } }), /whole sector period/u);
});
