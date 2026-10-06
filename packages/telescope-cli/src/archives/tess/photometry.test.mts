import assert from 'node:assert/strict';
import test from 'node:test';
import { besideCatalogued, notTurning, parseLightCurve, rotationVerdict, SKY_TERMS, withinBreakup } from './photometry.mts';

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

test('a rotation is believed from one sector only when the peak is strong, both orbits show it, it is short enough and the light swings enough', () => {
  const curve = parseLightCurve({ ...printed, halves: [{ ...peak, periodDays: 3.76 }, { ...peak, periodDays: 3.88 }] })!;
  assert.deepEqual(rotationVerdict(curve), { detected: true, periodDays: 3.88, amplitude: 0.031 });
  assert.match(rotationVerdict({ ...curve, whole: { ...peak, power: 0.21 } }).reason!, /No period stands out/u);
  assert.match(rotationVerdict({ ...curve, halves: [{ ...peak, periodDays: 3.19 }, { ...peak, periodDays: 5.64 }] }).reason!, /two orbits do not show the same period \(3\.19 d and 5\.64 d/u);
  assert.match(rotationVerdict({ ...curve, halves: [curve.halves[0]!, null] }).reason!, /two orbits/u);
  const slow = { ...peak, periodDays: 12.72 }, long = rotationVerdict({ ...curve, whole: slow, halves: [slow, slow] });
  assert.deepEqual([long.detected, long.periodDays], [false, undefined]); assert.match(long.reason!, /12\.72 d is longer than the 9 d a sector can vouch for/u);
  // The three wrong periods of the labelled stars all swung under 0.7%.
  assert.match(rotationVerdict({ ...curve, whole: { ...peak, amplitude: 0.0051 } }).reason!, /swings by 0\.51% at 3\.88 d, under the 0\.7%/u);
  assert.match(rotationVerdict({ ...curve, saturated: true }).reason!, /saturates/u);
});

test('a period is set beside the one the star\'s record holds: the same, its half, or not believed', () => {
  const seen = { detected: true, periodDays: 3.2, amplitude: 0.0075 };
  assert.deepEqual(besideCatalogued(seen, undefined), seen); assert.deepEqual(besideCatalogued(seen, 3.4), seen);
  // HD 63433 in sector 47: the light repeats every 3.2 d, and the catalogues print 6.508 d.
  assert.deepEqual(besideCatalogued(seen, 6.508), { detected: true, periodDays: 6.4, lightPeriodDays: 3.2, amplitude: 0.0075 });
  assert.match(besideCatalogued(seen, 8.58).reason!, /3\.2 d, is neither the star's catalogued rotation period, 8\.58 d, nor its half/u);
  assert.deepEqual(besideCatalogued({ detected: false, reason: 'weak' }, 6.5), { detected: false, reason: 'weak' });
});

test('a period shorter than an orbit at the star\'s surface is not its rotation', () => {
  // EPIC 205979159, a giant of 7 solar radii: its pixels show 0.16 d, and nothing could turn it faster than 2.3 d.
  const seen = { detected: true, periodDays: 0.16, amplitude: 0.0142 };
  assert.match(withinBreakup(seen, 2.3004).reason!, /0\.16 d, is shorter than the 2\.30 d of an orbit at the star's surface/u);
  // AU Mic, a dwarf: 4.85 d against 0.12 d.
  assert.deepEqual(withinBreakup({ detected: true, periodDays: 4.85, amplitude: 0.085 }, 0.1163), { detected: true, periodDays: 4.85, amplitude: 0.085 });
  assert.deepEqual(withinBreakup(seen, undefined), seen);
});

test('a star SIMBAD files as eclipsing or pulsating is not read for a rotation', () => {
  assert.match(notTurning('Eclipsing Binary', '* > ** > EB*')!, /SIMBAD lists the star as Eclipsing Binary/u);
  assert.match(notTurning('Classical Cepheid Variable', '* > Ev* > Ce* > cC*')!, /Classical Cepheid/u); assert.match(notTurning('gamma Dor Variable', '* > MS* > gD*')!, /gamma Dor/u);
  // Spotted stars, young stars and plain stars are read.
  for (const path of ['* > ** > BY*', '* > ** > RS*', '* > V* > Ro*', '* > Y*O > TT*', '* > V* > Er*', '* > PM*', '*']) assert.equal(notTurning('x', path), undefined);
  assert.equal(notTurning(undefined, undefined), undefined);
});
