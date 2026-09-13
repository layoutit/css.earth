import assert from 'node:assert/strict';
import test from 'node:test';
import { geometricDepth, conditionEmission } from './shape-prior.js';
import { projectEmission } from './solver.js';

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
