import assert from 'node:assert/strict';
import test from 'node:test';
import { fitDensitySimilarity, fitScore, projectSimilarity, type DensityFitInput } from './density-similarity.ts';
test('model-only similarity recovers asymmetric structure without changing particles or target', () => {
  const points: number[] = [];
  for (let i = 0; i < 1000; i++) {
    const t = i / 1000 * Math.PI * 2, radius = .3 + i % 13 / 13;
    points.push(Math.cos(t) * radius * 2 + (i % 4 === 0 ? 1.5 : 0), Math.sin(t) * radius * .4, (i % 7 - 3) * .03, 1);
  }
  const particles = new Float32Array(points), original = new Float32Array(particles), size = 64;
  const input: DensityFitInput = { particles, pivot: [0, 0, 0], distance: 62.44, target: new Float32Array(size * size), mask: new Uint8Array(size * size).fill(1), size, extent: 12 };
  const truth = { offset: [.5, -.25] as [number, number], rotationDeg: 60, scale: .65 };
  input.target = projectSimilarity(input, truth);
  const targetBefore = new Float32Array(input.target), result = fitDensitySimilarity(input, truth.offset);
  assert.ok(result.score > .97);
  assert.ok(fitScore(projectSimilarity(input, { ...truth, rotationDeg: 0 }), input.target, input.mask) < .8, 'Deleting the rotation must fail morphology agreement');
  assert.deepEqual(particles, original);
  assert.deepEqual(input.target, targetBefore);
});
