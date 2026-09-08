import { expect, test } from 'vitest';
import { intersectPreparedSurface, validateSurfaceDiscs, rayHitsPreparedTriangles, type SurfaceTriangle } from './prepared-surface-hit.js';

test('prepared surface hits distinguish an irregular extremity from empty space inside its bounding sphere', () => {
  const mesh: readonly SurfaceTriangle[] = [[[-3, -1, 0], [3, -1, 0], [0, 1, 0]]];
  expect(rayHitsPreparedTriangles([2.5, -.9, 5], [0, 0, -1], mesh)).toBe(true);
  expect(rayHitsPreparedTriangles([2.5, .9, 5], [0, 0, -1], mesh)).toBe(false);
  expect(rayHitsPreparedTriangles([0, 0, 5], [0, 0, 1], mesh)).toBe(false);
  expect(rayHitsPreparedTriangles([0, 0, 5], [1, 0, 0], mesh)).toBe(false);
  expect(rayHitsPreparedTriangles([0, 0, 5], [0, 0, -1], mesh)).toBe(true);
});

test('returns the nearest painted plane independent of storage order and the outer radial boundary', () => {
  const plane = (z: number): SurfaceTriangle => [[-4, -4, z], [4, -4, z], [0, 4, z]];
  const triangles = [plane(2), plane(7), plane(5)];
  expect(intersectPreparedSurface([0, 0, 10], [0, 0, -2], { triangles })).toEqual({ point: [0, 0, 7], distance: 1.5, triangleIndex: 1 });
  expect(intersectPreparedSurface([0, 0, 0], [0, 0, 1], { triangles }, true)?.point).toEqual([0, 0, 7]);
});

test('transparent cap corners cannot hide a painted plane behind them', () => {
  const triangles: SurfaceTriangle[] = [
    [[-2, -2, 3], [2, -2, 3], [2, 2, 3]], [[-2, -2, 3], [2, 2, 3], [-2, 2, 3]],
    [[-4, -4, 0], [4, -4, 0], [0, 4, 0]],
  ];
  const discs = [{ firstTriangle: 0, triangleCount: 2, center: [0, 0, 3] as const, axisU: [1, 0, 0] as const, axisV: [0, 1, 0] as const }];
  validateSurfaceDiscs(discs, triangles.length);
  expect(intersectPreparedSurface([.8, .8, 10], [0, 0, -1], { triangles, discs })?.point).toEqual([.8, .8, 0]);
  expect(intersectPreparedSurface([.6, .8, 10], [0, 0, -1], { triangles, discs })?.point).toEqual([.6, .8, 3]);
  expect(() => validateSurfaceDiscs([{ ...discs[0], triangleCount: 4 }], 3)).toThrow();
  expect(() => validateSurfaceDiscs([{ ...discs[0], axisV: [1, 0, 0] }], 3)).toThrow();
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
