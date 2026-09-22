import assert from 'node:assert/strict';
import { sourceTest } from '../../../tests/objects/source-test.mts';
const test = sourceTest();
import { BODIES, hostedOrbit, starAstrometry } from '@cssearth/astronomy';
import { mapBasisCurves } from './phase-curve.mts';
import { realSphericalHarmonics } from './spherical-harmonics.mts';
import { bandBrightnessTemperature, brightnessTemperature, planckRadiance, continuousHotspot, eigenBasis, equalAngleGrid, evaluateFit, fitEigenmap, percentiles, sampleEigenmap, seededRandom, symmetricEigen } from './eigenmap-fit.mts';

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

test('fixed stellar correction keeps the full stored dimension for posterior sampling but not BIC', () => {
  const basis = {
    curves: [Float64Array.from([-1, 0, 1])], uniform: Float64Array.from([1, 1, 1]),
    visible: Uint8Array.from([1, 1]), maps: [Float64Array.from([-1 / Math.PI, 1 / Math.PI])],
  };
  const fit = fitEigenmap(basis as never, 1, Float64Array.from([1.01, 1.01, 1.01]), new Float64Array(3).fill(0.1), () => true,
    { positive: false, fixStellarCorrection: true });
  const posterior = sampleEigenmap(basis as never, fit, { steps: 2000, burn: 200, keep: 50, seed: 1 });
  assert.equal(fit.parameters, 2);
  assert.equal(fit.normal.dimension, 3);
  assert.ok(Math.abs(fit.bic - (fit.chiSquared + 2 * Math.log(3))) < 1e-12);
  assert.deepEqual([...new Set(posterior.samples.map(sample => sample.length))], [3]);
  assert.ok(Math.max(...posterior.samples.flatMap(sample => Array.from(sample, Math.abs))) < 10);
  assert.ok(Math.min(...posterior.chiSquared) > -1e-8);
});

test('posterior sampling rejects inconsistent dimensions and non-positive-definite systems', () => {
  const basis = { visible: Uint8Array.from([1]), maps: [Float64Array.from([0])] };
  const fit = {
    normal: { dimension: 3, matrix: new Float64Array(9), rhs: new Float64Array(3), dataSquares: 0 }, ncurves: 1, parameters: 3,
    coefficients: Float64Array.from([0]), uniformAmplitude: 1, stellarCorrection: 0, systematics: new Float64Array(0),
  };
  assert.throws(() => sampleEigenmap(basis as never, { ...fit, normal: { ...fit.normal, rhs: new Float64Array(2) } } as never, { steps: 2, burn: 0, keep: 1 }), /dimensions/u);
  assert.throws(() => sampleEigenmap(basis as never, fit as never, { steps: 2, burn: 0, keep: 1 }), /positive definite/u);
  const identity = Float64Array.from([1, 0, 0, 0, 1, 0, 0, 0, 1]);
  assert.throws(() => sampleEigenmap(basis as never, { ...fit, normal: { ...fit.normal, matrix: identity, dataSquares: NaN } } as never,
    { steps: 2, burn: 0, keep: 1 }), /finite/u);
});

test('continuous hotspot refinement remains inside the observed grid-cell mask', () => {
  const grid = equalAngleGrid(90, 180), peak = 92 * Math.PI / 180;
  const basis = {
    lmax: 1, grid, visible: Uint8Array.from(grid.longitudes, longitude => Math.abs(longitude) < 90 ? 1 : 0),
    harmonicCoefficients: [Float64Array.from([Math.sin(peak) / Math.sqrt(3), 0, Math.cos(peak) / Math.sqrt(3)])],
  };
  const fit = { ncurves: 1, coefficients: Float64Array.from([0.5]), uniformAmplitude: 1 };
  const map = evaluateFit(basis as never, fit as never, grid.latitudes, grid.longitudes);
  const refined = continuousHotspot(basis as never, { ...fit, map } as never);
  assert.ok(Math.abs(refined.longitude) <= 90, `longitude ${refined.longitude} left the observed region`);
  const column = Math.floor((refined.longitude + 180) * grid.width / 360), row = Math.floor((refined.latitude + 90) * grid.height / 180);
  assert.equal(basis.visible[row * grid.width + column], 1);
});

test('continuous hotspot refinement wraps across the antimeridian', () => {
  const grid = equalAngleGrid(90, 180), targetLatitude = 23.4, targetLongitude = 179.6;
  const lat = targetLatitude * Math.PI / 180, lon = targetLongitude * Math.PI / 180;
  const basis = {
    lmax: 1, grid, visible: new Uint8Array(grid.latitudes.length).fill(1),
    harmonicCoefficients: [Float64Array.from([Math.cos(lat) * Math.sin(lon) / Math.sqrt(3), Math.sin(lat) / Math.sqrt(3), Math.cos(lat) * Math.cos(lon) / Math.sqrt(3)])],
  };
  const fit = { ncurves: 1, coefficients: Float64Array.from([0.5]), uniformAmplitude: 1 };
  const map = evaluateFit(basis as never, fit as never, grid.latitudes, grid.longitudes);
  const spot = continuousHotspot(basis as never, { ...fit, map } as never, 0.05);
  const longitudeError = Math.abs(((spot.longitude - targetLongitude + 540) % 360) - 180);
  assert.ok(Math.abs(spot.latitude - targetLatitude) < 0.06, `latitude ${spot.latitude}`);
  assert.ok(longitudeError < 0.06, `longitude ${spot.longitude}`);
});

test('brightness temperature inverts the Planck ratio: a planet as bright per area as the star has its temperature', () => {
  // Uniform planet of the star's temperature: flux per unit intensity = rp^2 / pi.
  const rp = 0.16, flux = rp ** 2 / Math.PI;
  assert.ok(Math.abs(brightnessTemperature(flux, 4.5, rp, 4400) - 4400) < 1e-6);
  assert.ok(brightnessTemperature(flux / 10, 4.5, rp, 4400) < 4400);
});

test('band brightness temperature agrees with the single-wavelength formula for a narrow band and weights a wide one', () => {
  const rp = 0.1, flux = 2e-3 / Math.PI;
  const narrow = { wavelengthMicrons: [4.4999, 4.5, 4.5001], response: [1, 1, 1] };
  const single = brightnessTemperature(flux, 4.5, rp, 4500), banded = bandBrightnessTemperature(flux, narrow, rp, { stellarTemperatureK: 4500 });
  assert.ok(Math.abs(banded - single) < 1e-3, `${banded} vs ${single}`);
  // A planet at the star's temperature reads that temperature over any band, with the star as blackbody or as a sampled spectrum.
  const wide = { wavelengthMicrons: Array.from({ length: 56 }, (_, i) => 5 + 0.1 * i), response: Array.from({ length: 56 }, (_, i) => 0.5 + 0.5 * Math.sin(i / 9)) };
  const same = rp ** 2 / Math.PI;
  assert.ok(Math.abs(bandBrightnessTemperature(same, wide, rp, { stellarTemperatureK: 4500 }) - 4500) < 1e-3);
  const sampled = { stellarIntensity: wide.wavelengthMicrons.map(w => planckRadiance(w, 4500)) };
  assert.ok(Math.abs(bandBrightnessTemperature(same, wide, rp, sampled) - 4500) < 1e-3);
  assert.ok(Number.isNaN(bandBrightnessTemperature(-1, wide, rp, { stellarTemperatureK: 4500 })));
});
