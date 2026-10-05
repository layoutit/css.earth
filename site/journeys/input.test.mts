import assert from 'node:assert/strict';
import { test } from 'node:test';
import { throwPoint } from './input.journey.mts';
import { createDragHistory, recordDragSample, estimateDragThrow } from '../../packages/engine/src/navigation/trackball-drag-inertia.ts';

const trackball = { centerX: 640, centerY: 400, radius: 230, viewportWidth: 1280, surfaceRadius: 230, focalLength: 1100 };
function throwFor(point: typeof throwPoint) {
  const history = createDragHistory();
  recordDragSample(history, { x: 640, y: 400, timestamp: 0, pitch: 0, yaw: 0 });
  for (let step = 1; step <= 8; step++) {
    const { x, y } = point(640, 400, step);
    recordDragSample(history, { x, y, timestamp: (step - 1) * 16, pitch: (y - 400) * .2, yaw: (x - 640) * .2 });
  }
  return estimateDragThrow({ history, releaseTimestamp: 128, frameMilliseconds: 16, trackball });
}
test('the coast journey trajectory passes the application throw gate', () => {
  assert.ok(throwFor(throwPoint), 'The actual journey must accelerate enough to launch inertia');
});
test('deleting trajectory acceleration turns the throw witness red', () => {
  assert.equal(throwFor((x, y, step) => ({ x: x + step * 8, y: y + step * 2 })), null);
});
