import assert from 'node:assert/strict';
import { sourceTest } from '../../../tests/objects/source-test.mts';
const test = sourceTest();
import { harmonicOrder, realSphericalHarmonics } from './spherical-harmonics.mts';
import { equalAngleGrid } from './eigenmap-fit.mts';

test('real harmonics are orthonormal with mean square 1 over the sphere (the starry normalization)', () => {
  const lmax = 4, grid = equalAngleGrid(180, 360), rows = realSphericalHarmonics(lmax, grid.latitudes, grid.longitudes);
  const weights = Float64Array.from(grid.latitudes, lat => Math.cos(lat * Math.PI / 180));
  const total = weights.reduce((sum, w) => sum + w, 0);
  const inner = (a: Float64Array, b: Float64Array) => { let s = 0; for (let i = 0; i < a.length; i++) s += a[i]! * b[i]! * weights[i]!; return s / total; };
  for (let i = 0; i < rows.length; i++) for (let j = i; j < rows.length; j++) {
    const value = inner(rows[i]!, rows[j]!);
    assert.ok(Math.abs(value - (i === j ? 1 : 0)) < 2e-4, `${harmonicOrder(lmax)[i]} x ${harmonicOrder(lmax)[j]} = ${value}`);
  }
});

test('low degrees match their closed forms: Y10 = sqrt(3) sin(lat), Y11 = sqrt(3) cos(lat) cos(lon)', () => {
  const [y1m1, y10, y11] = realSphericalHarmonics(1, [30, -60, 10], [45, 120, -80]);
  const lat = [30, -60, 10].map(v => v * Math.PI / 180), lon = [45, 120, -80].map(v => v * Math.PI / 180);
  lat.forEach((a, i) => {
    assert.ok(Math.abs(y10![i]! - Math.sqrt(3) * Math.sin(a)) < 1e-12);
    assert.ok(Math.abs(y11![i]! - Math.sqrt(3) * Math.cos(a) * Math.cos(lon[i]!)) < 1e-12);
    assert.ok(Math.abs(y1m1![i]! - Math.sqrt(3) * Math.cos(a) * Math.sin(lon[i]!)) < 1e-12);
  });
  assert.throws(() => harmonicOrder(0), /lmax/u);
});
