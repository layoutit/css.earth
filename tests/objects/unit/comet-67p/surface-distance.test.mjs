import assert from 'node:assert/strict';
import test from 'node:test';
import { triangleDistanceSquared, surfaceDistanceIndex } from '../../browser/comets/surface-distance.mjs';

test('surface distance distinguishes plane projection, edge and vertex regions', () => {
  const triangle = [[0, 0, 0], [2, 0, 0], [0, 2, 0]];
  assert.equal(triangleDistanceSquared([.5, .5, 3], triangle), 9);
  assert.equal(triangleDistanceSquared([1, -2, 3], triangle), 13);
  assert.equal(triangleDistanceSquared([3, 0, 0], triangle), 1);
  assert.equal(triangleDistanceSquared([2, 2, 0], triangle), 2);
  const translated = triangle.map(p => [p[0] + 7, p[1] - 2, p[2] + 4]);
  assert.equal(triangleDistanceSquared([7.5, -1.5, 7], translated), 9);
});

test('surface index finds the closest triangle across spatial partitions', () => {
  const positions = [], indices = [];
  for (let x = 0; x < 20; x++) {
    const index = positions.length;
    positions.push([x * 10, 0, 0], [x * 10 + 2, 0, 0], [x * 10, 2, 0]);
    indices.push([index, index + 1, index + 2]);
  }
  const distance = surfaceDistanceIndex(positions, indices);
  assert.equal(distance([170.5, .5, 3]), 3);
  assert.equal(distance([193, 0, 0]), 1);
});
