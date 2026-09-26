import { expect, test } from 'vitest';
import { detailedFocusContextOpacity } from './detailed-focus-context.js';
import type { WorldCameraPose } from '../navigation/world-camera.js';

const focus = { positionM: [1e12, -2e12, 3e12] as const, framingRadiusM: 1e6 };
const world = (radii: number): WorldCameraPose => ({ referenceFrame: 'fixture', epochJdTt: 1,
  pose: { positionM: [focus.positionM[0], focus.positionM[1], focus.positionM[2] + radii * focus.framingRadiusM], orientationXyzw: [0, 0, 0, 1] } });
test('close-up context covers native arrival, smoothly restores in physical focus radii, and leaves absent focus unchanged', () => {
  for (const distance of [0, .05, 6.1, 8]) expect(detailedFocusContextOpacity(world(distance), focus)).toBe(0);
  expect(detailedFocusContextOpacity(world(20), focus)).toBe(.5);
  for (const distance of [32, 100]) expect(detailedFocusContextOpacity(world(distance), focus)).toBe(1);
  const samples = Array.from({ length: 321 }, (_, index) => detailedFocusContextOpacity(world(index / 10), focus));
  expect(samples.every((value, index) => index === 0 || value >= samples[index - 1]!)).toBe(true);
  const camera = world(6.1), before = structuredClone(camera);
  expect(detailedFocusContextOpacity(camera, null)).toBe(1);
  expect(camera).toEqual(before);
});
