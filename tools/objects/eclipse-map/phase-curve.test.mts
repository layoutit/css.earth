import assert from 'node:assert/strict';
import { test } from 'node:test';
import { BODIES, hostedOrbit, starAstrometry } from '@cssearth/astronomy';
import { mapBasisCurves } from './phase-curve.mts';
import { equalAngleGrid } from './eigenmap-fit.mts';

test('light time leaves the transit where it is and delays the eclipse by 2a sin(i)/c', () => {
  const orbit = hostedOrbit('wasp-43b'), host = starAstrometry('wasp-43'), stellarRadiusKm = BODIES['wasp-43'].meanRadiusKm, rp = BODIES['wasp-43b'].meanRadiusKm / stellarRadiusKm;
  const grid = equalAngleGrid(45, 90), uniform = new Float64Array(grid.latitudes.length).fill(1 / Math.PI);
  const expected = 2 * orbit.semiMajorAxisStellarRadii * stellarRadiusKm * Math.sin(orbit.inclinationDegrees * Math.PI / 180) / 299792.458;
  // One second steps across eclipse ingress: the delayed curve should equal the instant one sampled `expected` seconds earlier.
  const eclipse = orbit.transitTimeBmjdTdb + 1000 * orbit.periodDays + orbit.periodDays / 2;
  const times = Float64Array.from({ length: 3600 }, (_, i) => eclipse - 0.04 + i / 86400);
  const [instant] = mapBasisCurves([uniform], grid, orbit, host, rp, times), [delayed] = mapBasisCurves([uniform], grid, orbit, host, rp, times, undefined, { stellarRadiusKm });
  let best = { shift: 0, residual: Infinity };
  for (let shift = 0; shift <= 40; shift++) {
    let residual = 0; for (let i = 40; i < times.length; i++) residual += (delayed![i]! - instant![i - shift]!) ** 2;
    if (residual < best.residual) best = { shift, residual };
  }
  assert.ok(Math.abs(best.shift - expected) <= 1, `eclipse delayed ${best.shift} s, expected ${expected.toFixed(1)} s`);
  // At transit the planet's own light needs no correction, so the day side seen there is unchanged.
  const transit = Float64Array.from({ length: 60 }, (_, i) => orbit.transitTimeBmjdTdb + 1000 * orbit.periodDays + (i - 30) / 86400);
  const [a] = mapBasisCurves([uniform], grid, orbit, host, rp, transit), [b] = mapBasisCurves([uniform], grid, orbit, host, rp, transit, undefined, { stellarRadiusKm });
  assert.ok(a!.every((value, i) => Math.abs(value - b![i]!) < 1e-9));
});
