/** The in-house eigencurve fit, run on the deposited JWST NIRSpec white-light curve, must reproduce the ThERESA re-runs recorded
 * in source/reference/theresa-reruns.md for the corrected axis (the fit's own geometry always spins about the orbit normal):
 * degree 3, 6 eigencurves, positive emission. It shares no code with starry or ThERESA, so agreement checks both. */
import assert from 'node:assert/strict';
import { sourceTest } from '../../source-test.mts';
const test = sourceTest('wasp-43b');
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { BODIES, hostedOrbit, starAstrometry } from '@cssearth/astronomy';
import { readTarMember } from '../../../../tools/objects/terrestrial-layers/tar-member.mts';
import { continuousHotspot, eigenBasis, equalAngleGrid, fitEigenmap, percentiles, sampleEigenmap } from '../../../../tools/objects/eclipse-map/eigenmap-fit.mts';

const deposit = resolve(import.meta.dirname, '../../../../src/objects/wasp-43b/source/science/challener-2024/wasp-43b.tar');
const load = async () => {
  const tar = await readFile(deposit);
  const numbers = (name: string) => Float64Array.from(readTarMember(tar, `wasp-43b/${name}`).toString('utf8').trim().split(/\s+/u).map(Number));
  const time = numbers('time.txt'), orbit = hostedOrbit('wasp-43b');
  // The transit (phases within 0.04 of mid-transit) measures the star, not the map; ThERESA's runs dropped the same samples.
  const use = (i: number) => { const phase = (((time[i]! - orbit.transitTimeBmjdTdb) / orbit.periodDays) % 1 + 1) % 1; return Math.min(phase, 1 - phase) >= 0.04; };
  return { time, data: numbers('flux-whitelight.txt'), error: numbers('ferr-whitelight.txt'), orbit, use,
    host: starAstrometry('wasp-43'), radiusRatio: BODIES['wasp-43b'].meanRadiusKm / BODIES['wasp-43'].meanRadiusKm };
};

test('degree 3 with 6 eigencurves: best fit matches ThERESA with the corrected axis, independent of the integration grid', async () => {
  const { time, data, error, orbit, use, host, radiusRatio } = await load();
  const results = [90, 180].map(height => {
    const basis = eigenBasis(3, equalAngleGrid(height, 2 * height), orbit, host, radiusRatio, time), fit = fitEigenmap(basis, 6, data, error, use);
    return { fit, spot: continuousHotspot(basis, fit, 0.05) };
  });
  // Measured 2026-09-17: chi2 8809.56 / 8809.68; hotspot -2.31, +7.09 / -2.31, +7.13. ThERESA (corrected axis): least-squares
  // latitude -2.5, MCMC chi2 8811.1 and longitude +6.9 over 4202 samples.
  for (const { fit, spot } of results) {
    assert.equal(fit.samples, 4202);
    assert.ok(fit.positive);
    assert.ok(Math.abs(fit.chiSquared - 8811.1) < 3, `chi2 ${fit.chiSquared}`);
    assert.ok(Math.abs(spot.latitude + 2.5) < 0.5, `latitude ${spot.latitude}`);
    assert.ok(Math.abs(spot.longitude - 6.9) < 0.5, `longitude ${spot.longitude}`);
  }
  assert.ok(Math.abs(results[0]!.spot.latitude - results[1]!.spot.latitude) < 0.1 && Math.abs(results[0]!.fit.chiSquared - results[1]!.fit.chiSquared) < 0.5, 'a finer grid changes nothing that matters');
});

test('the posterior puts the hotspot south of the equator and east of the substellar point, overlapping ThERESA\'s interval', async () => {
  const { time, data, error, orbit, use, host, radiusRatio } = await load();
  const basis = eigenBasis(3, equalAngleGrid(90, 180), orbit, host, radiusRatio, time), fit = fitEigenmap(basis, 6, data, error, use);
  const posterior = sampleEigenmap(basis, fit, { steps: 200000, burn: 5000, keep: 2000, seed: 43 });
  const spots = posterior.samples.map(x => continuousHotspot(basis, { ...fit, coefficients: x.slice(0, 6), uniformAmplitude: x[6]!, stellarCorrection: x[7]! }, 0.25));
  const latitude = percentiles(spots.map(spot => spot.latitude)), longitude = percentiles(spots.map(spot => spot.longitude));
  // Measured 2026-09-17: latitude -2.88 (-4.00 to -1.63), longitude 7.25 (6.88 to 7.50), 98.9% south. ThERESA corrected axis:
  // latitude -4.1 (-5.2 to -3.2), longitude 6.86 (+0.33 -0.27), every sample south.
  assert.ok(latitude.low < -3.2 && latitude.high < 0, `latitude ${latitude.low}..${latitude.high} overlaps -5.2..-3.2 and stays south`);
  assert.ok(longitude.low < 7.19 && longitude.high > 6.59, `longitude ${longitude.low}..${longitude.high} overlaps ThERESA's`);
  assert.ok(spots.filter(spot => spot.latitude < 0).length / spots.length > 0.95);
  assert.ok(posterior.acceptance > 0.05 && posterior.acceptance < 0.6, `acceptance ${posterior.acceptance}`);
});
