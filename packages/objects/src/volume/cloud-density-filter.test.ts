import assert from 'node:assert/strict';
import test from 'node:test';
import { cloudDensityWeight } from './cloud-density-filter.js';

test('cutoff zero preserves every kept alpha and smooth cutoff distinguishes centre from edge', () => {
  for (const density of [0, .1, .5, 1]) assert.equal(cloudDensityWeight(density,
    { cutoff: 0, softness: density, showRemoved: false }), 1);
  const filter = { cutoff: .5, softness: .4, showRemoved: false };
  assert.equal(cloudDensityWeight(.2, filter), 0);
  assert.ok(Math.abs(cloudDensityWeight(.5, filter) - .5) < 1e-14);
  assert.equal(cloudDensityWeight(.8, filter), 1);
});

