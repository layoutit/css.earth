import assert from 'node:assert/strict';
import { test } from 'vitest';
import { distanceForSilhouetteRadius, silhouetteRadiusAtDistance, rotationFromMatrix3d,
  offAxisFrame, silhouetteEllipse, rayHitsSphereBefore, splitVisible, clipSegmentToRectangle } from './heliocentric-geometry.js';
import { trailWeightsForSpans, validTrailSpans } from './heliocentric-view.js';

test('off-axis physical distance preserves the requested tangential apparent radius', () => {
  for (const bodyRadius of [1, 243.97, 605.18]) for (const focal of [300, 1247]) {
    for (const radius of [0.6, 16, 200]) for (const offset of [[0, 0], [180, -90]]) {
      const distance = distanceForSilhouetteRadius(bodyRadius, focal, radius, offset);
      assert.ok(distance > bodyRadius);
      assert.ok(Math.abs(silhouetteRadiusAtDistance(bodyRadius, focal, distance, offset) - radius) < 1e-9);
      if (offset[0] === 0) assert.ok(Math.abs(distance - bodyRadius * Math.hypot(focal, radius) / radius) < 1e-8);
    }
  }
  const ellipse = silhouetteEllipse(10, 100, 100, offAxisFrame(100, [50, 0]));
  assert.ok(ellipse.radialSemiAxis > ellipse.tangentialSemiAxis);
  assert.ok(ellipse.centre[0] < 0);
  assert.throws(() => silhouetteRadiusAtDistance(10, 100, 10), RangeError);
});

test('camera publication transposes CSS matrix storage without dropping roll', () => {
  const matrix = {m11: 1, m12: 2, m13: 3, m21: 4, m22: 5, m23: 6, m31: 7, m32: 8, m33: 9};
  assert.deepEqual(rotationFromMatrix3d(matrix), [1, 4, 7, 2, 5, 8, 3, 6, 9]);
});

test('occlusion removes only rays crossing the focused sphere before their endpoint', () => {
  assert.equal(rayHitsSphereBefore([0, 0, -20], [0, 0, -10], 2), true);
  assert.equal(rayHitsSphereBefore([0, 0, -5], [0, 0, -10], 2), false);
  assert.equal(rayHitsSphereBefore([20, 0, -20], [0, 0, -10], 2), false);
  const pieces = splitVisible([-2, 0, 0], [2, 0, 0], ([x]) => Math.abs(x) < 1);
  assert.equal(pieces.length, 2);
  assert.ok(Math.abs(pieces[0][1][0] + 1) < 1e-6);
  assert.ok(Math.abs(pieces[1][0][0] - 1) < 1e-6);
  assert.deepEqual(clipSegmentToRectangle([-20, 0], [20, 0], 10, 5), [0.25, 0.75]);
  assert.equal(clipSegmentToRectangle([-20, 6], [20, 6], 10, 5), null);
});

test('prepared trails retain a solid tail, linear fade and undrawn remainder', () => {
  assert.deepEqual(trailWeightsForSpans([0, 0.2, 0.3, 0.4, 0.8], {solidTurns: 0.2, fadeTurns: 0.2}), [1, 1, 0.5, 0, 0]);
  assert.equal(validTrailSpans({solidTurns: 0.4, fadeTurns: 0.6}), false);
  assert.throws(() => trailWeightsForSpans([0], {solidTurns: 0, fadeTurns: 0}), TypeError);
});
