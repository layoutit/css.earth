import assert from 'node:assert/strict';
import { test } from 'vitest';
import { distanceForSilhouetteRadius, silhouetteRadiusAtDistance, rotationFromMatrix3d,
  offAxisFrame, silhouetteEllipse, rayHitsSphereBefore, splitVisible, clipSegmentToRectangle } from './heliocentric-geometry.js';

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
  assert.equal(rayHitsSphereBefore([0, 0, -1e25], [0, 0, -1e7], 1e6), true, 'a nearby planet still occults a very distant source');
  assert.equal(rayHitsSphereBefore([0, 0, -1e25], [2e6, 0, -1e7], 1e6), false);
  const pieces = splitVisible([-2, 0, 0], [2, 0, 0], ([x]) => Math.abs(x) < 1);
  assert.equal(pieces.length, 2);
  assert.ok(Math.abs(pieces[0][1][0] + 1) < 1e-6);
  assert.ok(Math.abs(pieces[1][0][0] - 1) < 1e-6);
  assert.deepEqual(clipSegmentToRectangle([-20, 0], [20, 0], 10, 5), [0.25, 0.75]);
  assert.equal(clipSegmentToRectangle([-20, 6], [20, 6], 10, 5), null);
});

test('a planet offset from the Sun cannot falsely occult it while a kiloparsec observer rotates', () => {
  const distance = 3.085677581491367e19, separation = 3e12, radius = 2.5e7;
  for (let degrees = 1; degrees < 360; degrees++) {
    const angle = degrees * Math.PI / 180;
    if (Math.abs(Math.cos(angle)) < .01) continue;
    assert.equal(rayHitsSphereBefore([0, 0, -distance], [separation * Math.cos(angle), 0, -distance + separation * Math.sin(angle)], radius), false, `${degrees} degrees`);
  }
  assert.equal(rayHitsSphereBefore([0, 0, -distance], [0, 0, -distance + separation], radius), true);
  assert.equal(rayHitsSphereBefore([0, 0, -distance], [0, 0, -distance - separation], radius), false);
});
