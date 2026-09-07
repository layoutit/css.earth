import { expect, test } from 'vitest';
import { rayHitsPreparedTriangles, type SurfaceTriangle } from './prepared-surface-hit.js';

test('prepared surface hits distinguish an irregular extremity from empty space inside its bounding sphere', () => {
  const mesh: readonly SurfaceTriangle[] = [[[-3, -1, 0], [3, -1, 0], [0, 1, 0]]];
  expect(rayHitsPreparedTriangles([2.5, -.9, 5], [0, 0, -1], mesh)).toBe(true);
  expect(rayHitsPreparedTriangles([2.5, .9, 5], [0, 0, -1], mesh)).toBe(false);
  expect(rayHitsPreparedTriangles([0, 0, 5], [0, 0, 1], mesh)).toBe(false);
  expect(rayHitsPreparedTriangles([0, 0, 5], [1, 0, 0], mesh)).toBe(false);
  expect(rayHitsPreparedTriangles([0, 0, 5], [0, 0, -1], mesh)).toBe(true);
});
