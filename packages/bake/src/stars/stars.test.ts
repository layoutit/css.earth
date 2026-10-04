import assert from 'node:assert/strict';
import test from 'node:test';
import { hierarchyPosition, hierarchyMagnitude, hierarchyRadius } from './precision.ts';
import { prepareStarHierarchy } from './hierarchy.ts';

// Hierarchy aggregates are computed from the float32 source magnitudes, before transport quantization.

test('published aggregate precision removes observed cross-CPU tails without changing source values', () => {
  // Actual Node22 Linux-x64 / Darwin-arm64 results from the same pinned HYG rows.
  assert.deepEqual(hierarchyPosition([-76.99533507712503, 11.941339734320893, -82.57871778264439]),
    hierarchyPosition([-76.995335077125, 11.941339734320895, -82.5787177826444]));
  const magnitudes = [-2.592572389396131, -2.592572389396132];
  assert.equal(hierarchyMagnitude(magnitudes[0]!), hierarchyMagnitude(magnitudes[1]!));
  assert.equal(hierarchyMagnitude(-4.757106367063499), hierarchyMagnitude(-4.757106367063501),
    'Node 22/24 log10 tails at a half-quantum must publish the same magnitude');
  for (const value of magnitudes) assert(Math.abs(10 ** (-.4 * (hierarchyMagnitude(value) - value)) - 1) < 1e-12);
  for (const value of [0, .5e-10, 1e-10, 12.5, 998.12345678905]) {
    assert(hierarchyRadius(value) >= value, 'published radius cannot shrink its actual enclosure');
    assert(hierarchyRadius(value) - value < 1.51e-10);
  }
});

test('enclosing radii are recomputed from the rounded centre and retain exact source astrometry', () => {
  const star = { id: 'rounding-proof', positionUnits: [1.000000000049, 2, 3] as [number, number, number],
    absoluteMagnitude: 1.23456789012345, colorIndex: 0, name: null, coverageAnchor: false };
  const hierarchy = prepareStarHierarchy([star], [[255, 255, 255]], 32, 20), node = hierarchy.nodes[0]!;
  assert.equal(hierarchy.stars[0], star); assert.deepEqual(node.positionUnits, [1, 2, 3]);
  assert(node.radiusUnits >= Math.hypot(...star.positionUnits.map((v, i) => v - node.positionUnits[i]!)));
  assert(node.radiusUnits > 0, 'retaining the pre-rounding zero radius would wrongly cull this source row');
});
