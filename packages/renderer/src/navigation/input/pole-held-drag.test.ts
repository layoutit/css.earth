import assert from 'node:assert/strict';
import test from 'node:test';
import { planPoleCoast, poleCoastMovement, poleHoldFor, recordFrameMovement, turnPoleHeld } from './pole-held-drag.js';
import type { FrameMovement } from './pole-held-drag.js';
import type { TrackballMetrics } from '../types.js';
// CesiumJS 1.145.0's own globe under twelve drags, written by `node labs/experiments/drag-oracle/run.mts record`.
import recorded from '../../../../engine/src/navigation/pole-drag.cesium.json' with { type: 'json' };

const apart = (a: readonly number[], b: readonly number[]) => Math.max(...a.map((value, i) => Math.abs(value - b[i]!)));
const trackballOf = (gesture: (typeof recorded.gestures)[number]): TrackballMetrics => {
  const centerX = gesture.viewport.width / 2, centerY = gesture.viewport.height / 2;
  return { centerX, centerY, radius: 200, surfaceRadius: 200, focalLength: gesture.focalLength, viewportWidth: gesture.viewport.width, viewportHeight: gesture.viewport.height,
    pole: gesture.start.pole, meridian: gesture.start.meridian,
    grabSphere: { center: [0, 0, -gesture.distance], radius: 1, opticalCenterX: centerX, opticalCenterY: centerY, focalLength: gesture.focalLength } };
};

test('a pole-held drag and its coast end where Cesium\'s globe ends', () => {
  let coasted = 0, stayed = 0, left = 0;
  for (const gesture of recorded.gestures) {
    const trackball = trackballOf(gesture), hold = poleHoldFor(trackball);
    assert.ok(hold);
    // The press as the controller keeps it: this frame's movement and the one before it.
    const press = { x: 0, y: 0, movement: null as FrameMovement | null, lastMovement: null as FrameMovement | null, movementOpen: false };
    for (const frame of gesture.frames) {
      if (frame.movement) {
        const [startX, startY, endX, endY] = frame.movement;
        press.x = startX!; press.y = startY!;
        recordFrameMovement(press, endX!, endY!);
        turnPoleHeld(hold, trackball, press.movement!);
        press.movementOpen = false;
      }
      assert.equal(hold.rotating, frame.rotating, 'the drag left the globe in a different frame than Cesium\'s');
      assert.ok(apart(hold.pole, frame.pole) < 1e-6 && apart(hold.meridian, frame.meridian) < 1e-6, 'a frame of the drag ended away from Cesium\'s');
    }
    if (hold.rotating) left++;
    const coast = planPoleCoast({ pressedAt: 1000, releasedAt: 1000 + gesture.pressMilliseconds, lastMovement: press.lastMovement, trackball, hold });
    if (coast) {
      coasted++;
      for (let frame = 1; ; frame++) {
        const movement = poleCoastMovement(coast, 1000 + gesture.pressMilliseconds + frame * recorded.frameMilliseconds);
        if (movement === null) break;
        turnPoleHeld(hold, trackball, movement);
      }
    } else stayed++;
    assert.ok(apart(hold.pole, gesture.rest.pole) < 1e-6 && apart(hold.meridian, gesture.rest.meridian) < 1e-6, 'the globe came to rest away from Cesium\'s');
  }
  assert.ok(coasted >= 3 && stayed >= 3 && left >= 2, `the recording covers ${coasted} coasts, ${stayed} releases that stay and ${left} drags off the globe`);
});

test('only a press under 0.4 s with a movement before its last frame coasts, by half that movement', () => {
  const trackball = trackballOf(recorded.gestures[0]!), hold = poleHoldFor(trackball)!;
  const lastMovement = { startX: 300, startY: 200, endX: 320, endY: 190 };
  assert.equal(planPoleCoast({ pressedAt: 0, releasedAt: 400, lastMovement, trackball, hold }), null);
  assert.equal(planPoleCoast({ pressedAt: 0, releasedAt: 399, lastMovement: null, trackball, hold }), null);
  assert.equal(planPoleCoast({ pressedAt: 0, releasedAt: 399, lastMovement: { ...lastMovement, endX: 300, endY: 200 }, trackball, hold }), null);
  const coast = planPoleCoast({ pressedAt: 0, releasedAt: 399, lastMovement, trackball, hold });
  assert.ok(coast);
  assert.deepEqual(poleCoastMovement(coast, 399), { startX: 300, startY: 200, endX: 310, endY: 195 });
  const later = poleCoastMovement(coast, 799);
  assert.ok(later && Math.abs(later.endX - (300 + 10 * Math.exp(-1))) < 1e-12);
  // Half a pixel: 0.5 = hypot(10, 5) exp(-2.5 t) at t = 1.243 s.
  assert.ok(poleCoastMovement(coast, 399 + 1240) !== null);
  assert.equal(poleCoastMovement(coast, 399 + 1250), null);
});

test('a body that publishes no pole, meridian, drawn body or viewport is not held', () => {
  const trackball = trackballOf(recorded.gestures[0]!);
  for (const missing of ['pole', 'meridian', 'grabSphere', 'viewportHeight'] as const) assert.equal(poleHoldFor({ ...trackball, [missing]: undefined }), null);
});
