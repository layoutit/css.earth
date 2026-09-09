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

test('an open surface targets its painted side and rejects the same triangle from behind', () => {
  const mesh: readonly SurfaceTriangle[] = [[[0,0,0],[1,0,0],[0,1,0]]];
  expect(rayHitsPreparedTriangles([.2,.2,2],[0,0,-1],mesh,'counter-clockwise')).toBe(true);
  expect(rayHitsPreparedTriangles([.2,.2,-2],[0,0,1],mesh,'counter-clockwise')).toBe(false);
  expect(rayHitsPreparedTriangles([.2,.2,-2],[0,0,1],mesh,'clockwise')).toBe(true);
  expect(rayHitsPreparedTriangles([.2,.2,2],[0,0,-1],mesh,'clockwise')).toBe(false);
  // Existing closed-surface plans keep their original double-sided behavior.
  expect(rayHitsPreparedTriangles([.2,.2,-2],[0,0,1],mesh)).toBe(true);
});

test('only the selected prepared model contributes surface hits', () => {
  const triangles: SurfaceTriangle[] = [
    [[-3,-1,0],[-1,-1,0],[-2,1,0]], [[1,-1,0],[3,-1,0],[2,1,0]],
  ];
  const first = { start: 0, count: 1 }, second = { start: 1, count: 1 };
  expect(rayHitsPreparedTriangles([-2,0,5],[0,0,-1],triangles,undefined,first)).toBe(true);
  expect(rayHitsPreparedTriangles([-2,0,5],[0,0,-1],triangles,undefined,second)).toBe(false);
  expect(rayHitsPreparedTriangles([2,0,5],[0,0,-1],triangles,undefined,second)).toBe(true);
  expect(rayHitsPreparedTriangles([2,0,5],[0,0,-1],triangles,undefined,first)).toBe(false);
});
