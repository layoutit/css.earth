import { test } from 'node:test';
import assert from 'node:assert/strict';
import { occluderDepth } from './cloud-occluder.js';

/** A ball of radius 1 at the origin, and an ellipsoid long along x. */
const ball = { centreUnits: [0, 0, 0], axesUnits: [[1, 0, 0], [0, 1, 0], [0, 0, 1]] } as const;
const long = { centreUnits: [0, 0, 0], axesUnits: [[4, 0, 0], [0, 1, 0], [0, 0, 1]] } as const;

test('a sight line is as deep in the occluder as it passes near an ellipsoid\'s middle, between the eye and the point only', () => {
  const depth = occluderDepth([ball]);
  // the eye at z = 10; each point given as its offset from the eye
  assert.equal(depth(0, 0, 10, 0, 0, -20), 1, 'through the middle to a point behind it: the whole depth');
  assert.equal(depth(0, 0, 10, 5, 0, -20), 0, 'a sight line that passes beside it is clear');
  assert.equal(depth(0, 0, 10, 0, 0, -5), 0, 'a point in front of the ellipsoid is not behind it');
  assert.equal(depth(0, 0, -10, 0, 0, -5), 0, 'nor is a point when the ellipsoid stands behind the eye');
  const grazing = depth(0, 0, 10, 1.6, 0, -20), inner = depth(0, 0, 10, .8, 0, -20);
  assert.ok(grazing > 0 && grazing < inner && inner < 1, `nearer its rim, less deep: ${grazing} < ${inner} < 1`);
  // A sight line 0.8 from the middle is in the ball 1 - 0.8² of the way: its depth eases in as 1 - (1 - 0.36)².
  assert.ok(Math.abs(depth(.8, 0, 10, 0, 0, -20) - (1 - (1 - .36) ** 2)) < 1e-12, `${depth(.8, 0, 10, 0, 0, -20)}`);
  assert.equal(occluderDepth([])(0, 0, 10, 0, 0, -20), 0, 'with no occluder nothing is hidden');
  assert.equal(occluderDepth([ball, long])(0, 0, 10, 0, 0, -20), 1, 'the deepest ellipsoid counts');
  const along = occluderDepth([long]);
  assert.ok(along(3, 0, 10, 0, 0, -20) > 0 && depth(3, 0, 10, 0, 0, -20) === 0, 'an ellipsoid reaches as far as its axes do');
});

test('an ellipsoid whose axes are not perpendicular is measured along its own axes', () => {
  // Axes a = (1,0,0), b = (1,1,0), c = (0,0,1): a point is αa + βb + γc with β = y, α = x - y, γ = z, so the ellipsoid is
  // (x - y)² + y² + z² ≤ 1. A sight line down z through x = y = 0.9 passes its middle at α = 0, β = 0.9: r² = 0.81, so its
  // depth is 1 - (1 - (1 - 0.81))² = 1 - 0.81².
  const oblique = occluderDepth([{ centreUnits: [0, 0, 0], axesUnits: [[1, 0, 0], [1, 1, 0], [0, 0, 1]] }]);
  assert.ok(Math.abs(oblique(.9, .9, 10, 0, 0, -20) - (1 - .81 ** 2)) < 1e-12, `${oblique(.9, .9, 10, 0, 0, -20)}`);
  assert.equal(oblique(.9, -.9, 10, 0, 0, -20), 0, 'across its long diagonal, (1.8)² + 0.81 > 1: clear');
  assert.equal(oblique(0, 0, 10, 0, 0, -20), 1, 'through its middle, the whole depth');
});
