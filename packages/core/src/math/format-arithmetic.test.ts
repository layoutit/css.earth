import assert from 'node:assert/strict';
import test from 'node:test';
import { convexWindowEdges } from './convex-window.js';
import { limbIntensity } from './limb-intensity.js';
test('convex planes face inward for either winding and reject degeneracy', () => {
  const polygon: [number, number][] = [[-1, -1], [1, -1], [1, 1], [-1, 1]];
  for (const points of [polygon, [...polygon].reverse()]) {
    const edges = convexWindowEdges(points);
    assert.equal(edges.length, 4);
    for (const edge of edges) assert.equal(-edge.x * edge.nx - edge.y * edge.ny, 1);
  }
  assert.throws(() => convexWindowEdges([[0, 0], [1, 0], [2, 0], [0, 1]]), /strictly convex quadrilateral/);
});
test('limb evaluation preserves quadratic and power endpoints and interior', () => {
  assert.equal(limbIntensity(0, { u1: .2, u2: .3 }), .5);
  assert.ok(Math.abs(limbIntensity(.5, { u1: .2, u2: .3 }) - .825) < 1e-15);
  assert.equal(limbIntensity(1, { u1: .2, u2: .3 }), 1);
  assert.equal(limbIntensity(-1, { law: 'power', alpha: 2 }), 0);
  assert.equal(limbIntensity(.5, { law: 'power', alpha: 2 }), .25);
});
