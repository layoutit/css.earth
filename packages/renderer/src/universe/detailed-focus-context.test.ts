import { test } from 'node:test';
import assert from 'node:assert/strict';
import { isDeepStrictEqual } from 'node:util';
import { detailedFocusContextOpacity, selectedBodyContextOpacity } from './detailed-focus-context.js';
import type { WorldCameraPose } from '../navigation/world-camera.js';

const focus = { positionM: [1e12, -2e12, 3e12] as const, framingRadiusM: 1e6 };
const world = (radii: number): WorldCameraPose => ({ referenceFrame: 'fixture', epochJdTt: 1,
  pose: { positionM: [focus.positionM[0], focus.positionM[1], focus.positionM[2] + radii * focus.framingRadiusM], orientationXyzw: [0, 0, 0, 1] } });
test('close-up context covers native arrival, smoothly restores in physical focus radii, and leaves absent focus unchanged', () => {
  for (const distance of [0, .05, 6.1, 8]) assert.equal(detailedFocusContextOpacity(world(distance), focus), 0);
  assert.equal(detailedFocusContextOpacity(world(20), focus), .5);
  for (const distance of [32, 100]) assert.equal(detailedFocusContextOpacity(world(distance), focus), 1);
  const samples = Array.from({ length: 321 }, (_, index) => detailedFocusContextOpacity(world(index / 10), focus));
  assert.equal(samples.every((value, index) => index === 0 || value >= samples[index - 1]!), true);
  const camera = world(6.1), before = structuredClone(camera);
  assert.equal(detailedFocusContextOpacity(camera, null), 1);
  assert.deepEqual(camera, before);
});

test('body close-ups suppress distant clouds by projected size across viewports and camera lenses', () => {
  const body = { positionM: focus.positionM, radiusM: focus.framingRadiusM };
  for (const height of [390, 820, 1440]) {
    const viewport = { focalPixels: height, widthPixels: height, heightPixels: height * 1.5,
      principalOffsetPixels: [0, 0] as const };
    assert.equal(selectedBodyContextOpacity(world(6), viewport, body), 0);
    assert.equal(selectedBodyContextOpacity(world(40), viewport, body), 1);
    const mid = selectedBodyContextOpacity(world(16), viewport, body);
    assert.ok(mid > 0); assert.ok(mid < 1);
    assert.equal(selectedBodyContextOpacity({ ...world(16), projectionScale: 2 }, viewport, body), 0);
  }
});
