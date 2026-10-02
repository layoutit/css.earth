import { type SurfaceTriangle } from '@cssearth/objects';

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { rayHitsPreparedTriangles } from './prepared-surface-hit.js';

test('prepared surface hits distinguish an irregular extremity from empty space inside its bounding sphere', () => {
  const mesh: readonly SurfaceTriangle[] = [[[-3, -1, 0], [3, -1, 0], [0, 1, 0]]];
  assert.equal(rayHitsPreparedTriangles([2.5, -.9, 5], [0, 0, -1], mesh), true);
  assert.equal(rayHitsPreparedTriangles([2.5, .9, 5], [0, 0, -1], mesh), false);
  assert.equal(rayHitsPreparedTriangles([0, 0, 5], [0, 0, 1], mesh), false);
  assert.equal(rayHitsPreparedTriangles([0, 0, 5], [1, 0, 0], mesh), false);
  assert.equal(rayHitsPreparedTriangles([0, 0, 5], [0, 0, -1], mesh), true);
});

test('an open surface targets its painted side and rejects the same triangle from behind', () => {
  const mesh: readonly SurfaceTriangle[] = [[[0,0,0],[1,0,0],[0,1,0]]];
  assert.equal(rayHitsPreparedTriangles([.2,.2,2],[0,0,-1],mesh,'counter-clockwise'), true);
  assert.equal(rayHitsPreparedTriangles([.2,.2,-2],[0,0,1],mesh,'counter-clockwise'), false);
  assert.equal(rayHitsPreparedTriangles([.2,.2,-2],[0,0,1],mesh,'clockwise'), true);
  assert.equal(rayHitsPreparedTriangles([.2,.2,2],[0,0,-1],mesh,'clockwise'), false);
  // Existing closed-surface plans keep their original double-sided behavior.
  assert.equal(rayHitsPreparedTriangles([.2,.2,-2],[0,0,1],mesh), true);
});

test('only the selected prepared model contributes surface hits', () => {
  const triangles: SurfaceTriangle[] = [
    [[-3,-1,0],[-1,-1,0],[-2,1,0]], [[1,-1,0],[3,-1,0],[2,1,0]],
  ];
  const first = { start: 0, count: 1 }, second = { start: 1, count: 1 };
  assert.equal(rayHitsPreparedTriangles([-2,0,5],[0,0,-1],triangles,undefined,first), true);
  assert.equal(rayHitsPreparedTriangles([-2,0,5],[0,0,-1],triangles,undefined,second), false);
  assert.equal(rayHitsPreparedTriangles([2,0,5],[0,0,-1],triangles,undefined,second), true);
  assert.equal(rayHitsPreparedTriangles([2,0,5],[0,0,-1],triangles,undefined,first), false);
});
