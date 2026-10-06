import assert from 'node:assert/strict';
import { test } from 'node:test';
import { parseStellarExtents } from './stellar-extents.mts';

test('prepared stellar extents refuse a radius that is not a positive length', () => {
  assert.throws(() => parseStellarExtents({ lmc: 0 }), /lmc needs a positive radius/);
  assert.throws(() => parseStellarExtents([]), /object of radii/);
});
