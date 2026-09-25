import assert from 'node:assert/strict';
import test from 'node:test';
import { cloudDensityWeight, createIntegratedSignalSampler, filterCloudDensityRgba, partitionCloudAlpha } from '@cssearth/bake/volume';
import { cloudTextureTexelPoint } from '../../server/services/density-material.ts';

test('cutoff zero preserves every kept alpha and smooth cutoff distinguishes centre from edge', () => {
  for (const density of [0, .1, .5, 1]) assert.equal(cloudDensityWeight(density,
    { cutoff: 0, softness: density, showRemoved: false }), 1);
  const filter = { cutoff: .5, softness: .4, showRemoved: false };
  assert.equal(cloudDensityWeight(.2, filter), 0);
  assert.ok(Math.abs(cloudDensityWeight(.5, filter) - .5) < 1e-14);
  assert.equal(cloudDensityWeight(.8, filter), 1);
});

test('non-square texture texels retain each prepared X/Y/Z leaf plane and centre', () => {
  const planes: Array<[[number, number, number], [number, number, number], [number, number, number], [number, number, number]]> = [
    [[2, -3, -5], [2, 7, -5], [2, 7, 9], [2, -3, 9]],
    [[-4, 6, -5], [8, 6, -5], [8, 6, 9], [-4, 6, 9]],
    [[-4, -3, 11], [8, -3, 11], [8, 7, 11], [-4, 7, 11]]
  ];
  for (const [axis, vertices] of planes.entries()) {
    const [a, b, , d] = vertices, matrix = Array(16).fill(0); matrix[15] = 1;
    const css = (point: [number, number, number]) => [point[1] * 50, point[0] * 50, point[2] * 50];
    const ac = css(a), bc = css(b), dc = css(d);
    for (let component = 0; component < 3; component++) {
      matrix[component] = (bc[component]! - ac[component]!) / 10;
      matrix[4 + component] = (dc[component]! - ac[component]!) / 6;
      matrix[12 + component] = ac[component]!;
    }
    const geometry = { width: 5, height: 3, matrix,
      backgroundSize: [10, 6] as [number, number], backgroundPosition: [0, 0] as [number, number] };
    const mean = [0, 0, 0];
    for (let y = 0; y < geometry.height; y++) for (let x = 0; x < geometry.width; x++) {
      const point = cloudTextureTexelPoint(geometry, x, y); for (let a = 0; a < 3; a++) mean[a]! += point[a]! / 15;
    }
    const expected = vertices[0].map((value, a) => (value + vertices[2][a]!) / 2);
    for (let a = 0; a < 3; a++) assert.ok(Math.abs(mean[a]! - expected[a]!) < 1e-12);
    assert.ok(vertices.every(vertex => vertex[axis] === expected[axis]));
  }
});

test('integrated signal is globally normalized, brighter at centre, and invariant along an Earth ray', () => {
  const sample = createIntegratedSignalSampler({ values: Float32Array.from([
    .05, .1, .05,
    .1, 1, .1,
    .05, .1, .05
  ]), width: 3, height: 3, bounds: { min: [-1, -1], max: [1, 1] }, observerDistance: 10 });
  const centre = sample(0, 0, 0), outer = sample(2 / 3, 0, 0);
  assert.equal(centre, 1); assert.ok(outer < centre);
  assert.ok(Math.abs(sample(-2 / 3, 2 / 3, 0) - .05) < 1e-7);
  for (const z of [-2, 0, 4]) assert.ok(Math.abs(sample(.25 * (1 + z / 10), -.4 * (1 + z / 10), z) - sample(.25, -.4, 0)) < 1e-12);
  assert.equal(cloudDensityWeight(outer, { cutoff: .2, softness: 0, showRemoved: false }), 0);
  assert.equal(cloudDensityWeight(centre, { cutoff: .2, softness: 0, showRemoved: false }), 1);
});

test('kept and removed optical weights partition a nonzero source alpha', () => {
  const alpha = .73, weight = .38;
  const kept = partitionCloudAlpha(alpha, weight, false), removed = partitionCloudAlpha(alpha, weight, true);
  assert.ok(kept > 0 && removed > 0);
  assert.ok(Math.abs((1 - kept) * (1 - removed) - (1 - alpha)) < 1e-14);
  assert.equal(partitionCloudAlpha(alpha, 1, false), alpha);
  assert.equal(partitionCloudAlpha(alpha, 1, true), 0);
});

test('RGBA filtering preserves geometry-sized RGB and partitions alpha without invented glow', () => {
  const input = Uint8Array.from([20, 30, 40, 0, 35, 45, 55, 120, 50, 60, 70, 180, 80, 90, 100, 255]);
  const density = Float32Array.from([0, .1, .5, 1]);
  const kept = filterCloudDensityRgba(input, density, { cutoff: .5, softness: 0, showRemoved: false });
  const removed = filterCloudDensityRgba(input, density, { cutoff: .5, softness: 0, showRemoved: true });
  for (let pixel = 0; pixel < 4; pixel++) for (let channel = 0; channel < 3; channel++) {
    assert.equal(kept[4 * pixel + channel], input[4 * pixel + channel]);
    assert.equal(removed[4 * pixel + channel], input[4 * pixel + channel]);
  }
  assert.deepEqual([...kept.filter((_, i) => i % 4 === 3)], [0, 0, 180, 255]);
  assert.deepEqual([...removed.filter((_, i) => i % 4 === 3)], [0, 120, 0, 0]);
});
