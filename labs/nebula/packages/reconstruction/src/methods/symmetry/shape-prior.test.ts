import assert from 'node:assert/strict';
import test from 'node:test';
import { geometricDepth, conditionEmission } from '@cssearth/nebula-reconstruction/methods/symmetry/shape-prior';
import { projectEmission } from '@cssearth/nebula-reconstruction/methods/symmetry/solver';

test('a ring prior retains its empty center and never paints unsupported image pixels', () => {
  const grid = { width: 25, height: 25, depth: 25 };
  const density = geometricDepth(grid, [12, 12, 12], { sigmaCutoff: 3, components: [
    { kind: 'torus', axis: [0, 0, 1], radius: 8, radialSigma: 1, axialSigma: 2, weight: 1 },
  ] });
  const image = new Float32Array(625).fill(.5), result = conditionEmission(image, density, grid);
  const projection = projectEmission(result.volume, grid);
  assert.equal(projection[12 * 25 + 12], 0);
  assert.ok(Math.abs(projection[12 * 25 + 20]! - .5) < 1e-6);
  assert.ok(result.uncoveredSignalFraction > .3);
  for (let i = 0; i < density.length; i++) if (density[i] === 0) assert.equal(result.volume[i], 0);
});

test('changing the image changes emission but not the supplied depth distribution', () => {
  const grid = { width: 12, height: 12, depth: 12 };
  const density = geometricDepth(grid, [5.5, 5.5, 5.5], { sigmaCutoff: 3, components: [
    { kind: 'disk', axis: [0, 1, 1], radius: 4, radialSigma: 1, axialSigma: 1, weight: 1 },
  ] });
  const before = density.slice(), image = new Float32Array(144).fill(.2);
  const a = conditionEmission(image, density, grid), b = conditionEmission(image.map(v => v * 2), density, grid);
  assert.deepEqual(density, before);
  assert.deepEqual(b.volume, a.volume.map(v => v * 2));
});

test('a Sérsic spheroid falls outward, is flatter along its axis and ends at the cutoff', () => {
  const grid = { width: 41, height: 41, depth: 41 };
  const density = geometricDepth(grid, [20, 20, 20], { sigmaCutoff: 2.8, components: [
    { kind: 'sersic', axis: [1, 0, 0], radius: 6, radialSigma: 1, axialSigma: 1, weight: 1, sersicIndex: 4, axisRatio: .5 },
  ] });
  const at = (x: number, y: number, z: number) => density[(z * 41 + y) * 41 + x]!;
  assert.ok(at(20, 23, 20) > at(20, 28, 20), 'falls outward');
  assert.ok(at(24, 20, 20) < at(20, 24, 20), 'flatter along the axis');
  assert.ok(Math.abs(at(20, 26, 20) - 1) < .05, 'about one at the half-light radius');
  assert.equal(at(20, 20 + 17, 20), 0, 'nothing beyond 2.8 half-light radii');
  assert.throws(() => geometricDepth(grid, [20, 20, 20], { sigmaCutoff: 2.8, components: [
    { kind: 'sersic', axis: [1, 0, 0], radius: 6, radialSigma: 1, axialSigma: 1, weight: 1, sersicIndex: 4 },
  ] }), /axisRatio/);
  // A Sérsic spheroid may end beyond 8 half-light radii, so its end can lie outside all the image's light; a torus may not.
  const far = geometricDepth(grid, [20, 20, 20], { sigmaCutoff: 12, components: [
    { kind: 'sersic', axis: [1, 0, 0], radius: 1.5, radialSigma: 1, axialSigma: 1, weight: 1, sersicIndex: 1, axisRatio: 1 },
  ] });
  assert.ok(far[(20 * 41 + 20 + 15) * 41 + 20]! > 0, 'light at 10 half-light radii');
  assert.equal(far[(20 * 41 + 20 + 19) * 41 + 20], 0, 'nothing beyond 12 half-light radii');
  assert.throws(() => geometricDepth(grid, [20, 20, 20], { sigmaCutoff: 12, components: [
    { kind: 'torus', axis: [1, 0, 0], radius: 6, radialSigma: 1, axialSigma: 1, weight: 1 },
  ] }), /cutoff/);
});
