import { test } from 'node:test';
import assert from 'node:assert/strict';
import { validatePreparedLeafBounds } from '@cssearth/objects';
import { prepareSurfaceTargetRotation } from './surface-target.ts';
import { dotN as dot } from '@cssearth/core';

const apply = (matrix: readonly number[], point: readonly number[]) => [0, 1, 2].map(row =>
  matrix[row * 3] * point[0] + matrix[row * 3 + 1] * point[1] + matrix[row * 3 + 2] * point[2]);
const identity = [1, 0, 0, 0, 1, 0, 0, 0, 1];
test('surface correction is a finite proper rotation toward the real physical eye at every bearing', () => {
  for (const centre of [[0, 0, -100], [0, 0, 100], [35.474, 0, -253.001], [-90, 60, -200], [1, 0, 0],
    [1e308, -1e308, 1e308], [1e-200, 0, -1e-200], [1e-12, -1e-12, 10]]) {
    const matrix = prepareSurfaceTargetRotation(Object.freeze(centre));
    assert.equal(matrix.every(Number.isFinite), true);
    const max = Math.max(...centre.map(Math.abs)), direction = centre.map(value => -value / max);
    const length = Math.hypot(...direction), actual = apply(matrix, [0, 0, 1]);
    actual.forEach((value, axis) => assert.ok(Math.abs(value - (direction[axis] / length)) < 10 ** -13 / 2, `${value} is not close to ${direction[axis] / length}`));
    const rows = [matrix.slice(0, 3), matrix.slice(3, 6), matrix.slice(6, 9)];
    for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) assert.ok(Math.abs(dot(rows[i], rows[j]) - (Number(i === j))) < 10 ** -13 / 2, `${dot(rows[i], rows[j])} is not close to ${Number(i === j)}`);
    const determinant = matrix[0] * (matrix[4] * matrix[8] - matrix[5] * matrix[7]) -
      matrix[1] * (matrix[3] * matrix[8] - matrix[5] * matrix[6]) + matrix[2] * (matrix[3] * matrix[7] - matrix[4] * matrix[6]);
    assert.ok(Math.abs(determinant - (1)) < 10 ** -13 / 2, `${determinant} is not close to ${1}`);
  }
  assert.deepEqual(prepareSurfaceTargetRotation([0, 0, -1]), identity);
  for (const invalid of [[0, 0, 0], [0, 0], [0, NaN, -1], [Infinity, 0, -1]]) {
    assert.throws(() => prepareSurfaceTargetRotation(invalid));
  }
});

test('prepared destination correction preserves close-range framing when the globe radius changes', () => {
  // Destination preparation aligns its geographic target on +z; reader fixtures
  // use the objects leaf-bounds contract for that same prepared spatial point.
  for (const radius of [1, 1000, 6371000]) {
    const local = [0,0,radius];
    validatePreparedLeafBounds({ min: local, max: local });
    const focal = 1212.44, offset = [-170,0], depth = radius * 1.000004;
    const centre = [-offset[0]! * depth / focal, 0, -depth];
    const project = (rotation: readonly number[]) => {
      const q = apply(rotation, local).map((value, axis) => value + centre[axis]!);
      return [870 + offset[0]! + focal * q[0]! / -q[2]!, 500 + focal * q[1]! / -q[2]!];
    };
    const corrected = project(prepareSurfaceTargetRotation(centre));
    assert.ok(Math.abs(corrected[0]! - 870) < 10 ** -8 / 2);
    assert.ok(Math.abs(corrected[1]! - 500) < 10 ** -8 / 2);
    assert.ok(!(Math.abs(project(identity)[0]! - 870) < 10 ** -8 / 2));
  }
});
