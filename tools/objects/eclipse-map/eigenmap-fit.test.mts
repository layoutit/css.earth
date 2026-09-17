import assert from 'node:assert/strict';
import { test } from 'node:test';
import { BODIES, hostedOrbit, starAstrometry } from '@cssearth/astronomy';
import { mapBasisCurves } from './phase-curve.mts';
import { realSphericalHarmonics } from './spherical-harmonics.mts';
import { brightnessTemperature, continuousHotspot, eigenBasis, equalAngleGrid, fitEigenmap, percentiles, sampleEigenmap, seededRandom, symmetricEigen } from './eigenmap-fit.mts';

test('Jacobi eigenvectors diagonalize a symmetric matrix and come strongest first', () => {
  const random = seededRandom(7), n = 6, m = new Float64Array(n * n);
  for (let i = 0; i < n; i++) for (let j = i; j < n; j++) { const v = random.normal(); m[i * n + j] = v; m[j * n + i] = v; }
  const { values, vectors } = symmetricEigen(m, n);
  for (let k = 1; k < n; k++) assert.ok(values[k - 1]! >= values[k]!);
  for (let k = 0; k < n; k++) for (let i = 0; i < n; i++) {
    let mv = 0; for (let j = 0; j < n; j++) mv += m[i * n + j]! * vectors[k]![j]!;
    assert.ok(Math.abs(mv - values[k]! * vectors[k]![i]!) < 1e-10);
  }
});

test('an injected map with a hotspot 20 degrees east and 15 south is recovered from its own noisy phase curve', () => {
  // Synthetic observation on WASP-43b's orbit: two orbits sampled every 8 minutes, the map built from degree-1 harmonics on a
  // finer grid than the fit uses, with 30 ppm Gaussian noise, a binned JWST white-light level at which a southward offset is detectable.
  const orbit = hostedOrbit('wasp-43b'), host = starAstrometry('wasp-43'), rp = BODIES['wasp-43b'].meanRadiusKm / BODIES['wasp-43'].meanRadiusKm;
  const times = Float64Array.from({ length: 360 }, (_, i) => orbit.transitTimeBmjdTdb + 0.3 + i * 8 / 1440);
  const fine = equalAngleGrid(180, 360), [y1m1, y10, y11] = realSphericalHarmonics(1, fine.latitudes, fine.longitudes);
  const east = 20 * Math.PI / 180, south = 15 * Math.PI / 180;
  // Intensity peaking toward (lat -15, lon +20): a dipole along that direction on top of a uniform planet.
  const truth = Float64Array.from({ length: fine.latitudes.length }, (_, c) => (1 + 0.8 * (Math.cos(south) * (Math.cos(east) * y11![c]! + Math.sin(east) * y1m1![c]!) - Math.sin(south) * y10![c]!) / Math.sqrt(3)) * 2e-3 / Math.PI);
  const [model] = mapBasisCurves([truth], fine, orbit, host, rp, times);
  const random = seededRandom(3), sigma = 3e-5;
  const data = Float64Array.from(model!, value => 1 + value + sigma * random.normal()), errors = new Float64Array(times.length).fill(sigma);
  // Choose the model as an analysis would: the lowest BIC over degrees 1-2 and their eigencurve counts. Higher degrees fit noise in
  // directions a light curve barely constrains, which is why a single over-fitted map can put its maximum far from the truth.
  const grid = equalAngleGrid(90, 180), candidates = [1, 2].flatMap(lmax => {
    const basis = eigenBasis(lmax, grid, orbit, host, rp, times);
    return Array.from({ length: basis.curves.length }, (_, k) => ({ basis, fit: fitEigenmap(basis, k + 1, data, errors, () => true) }));
  });
  const { basis, fit } = candidates.reduce((best, candidate) => candidate.fit.bic < best.fit.bic ? candidate : best);
  const spot = continuousHotspot(basis, fit, 0.25);
  assert.equal(basis.lmax, 1, 'BIC selects the injected degree');
  assert.ok(fit.positive);
  assert.ok(Math.abs(spot.longitude - 20) < 3, `longitude ${spot.longitude}`);
  assert.ok(Math.abs(spot.latitude + 15) < 5, `latitude ${spot.latitude}`);
  assert.ok(Math.abs(fit.chiSquared / fit.samples - 1) < 0.25, `reduced chi2 ${fit.chiSquared / fit.samples}`);
  const n = fit.ncurves, posterior = sampleEigenmap(basis, fit, { steps: 20000, burn: 2000, keep: 200, seed: 5 });
  const lon = percentiles(posterior.samples.map(x => continuousHotspot(basis, { ...fit, coefficients: x.slice(0, n), uniformAmplitude: x[n]!, stellarCorrection: x[n + 1]! }, 0.25).longitude));
  assert.ok(lon.low <= 20.5 && lon.high >= 19.5 && lon.high - lon.low < 3, `posterior longitude ${lon.low}..${lon.high} covers the injected 20`);
});

test('brightness temperature inverts the Planck ratio: a planet as bright per area as the star has its temperature', () => {
  // Uniform planet of the star's temperature: flux per unit intensity = rp^2 / pi.
  const rp = 0.16, flux = rp ** 2 / Math.PI;
  assert.ok(Math.abs(brightnessTemperature(flux, 4.5, rp, 4400) - 4400) < 1e-6);
  assert.ok(brightnessTemperature(flux / 10, 4.5, rp, 4400) < 4400);
});
