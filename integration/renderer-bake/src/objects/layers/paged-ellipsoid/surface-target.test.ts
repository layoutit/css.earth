import { test } from 'node:test';
import assert from 'node:assert/strict';
import { isDeepStrictEqual } from 'node:util';
import { readFile } from 'node:fs/promises';
import { preparedScenePitch } from '@cssearth/engine';
import { prepareLocationPoint, prepareLocationCamera } from '@cssearth/bake/objects/layers/paged-ellipsoid';
import { prepareSurfaceTargetRotation } from '@cssearth/renderer/navigation/surface-target.ts';
import { dotN as dot } from '@cssearth/core';

const apply = (matrix: readonly number[], point: readonly number[]) => [0, 1, 2].map(row =>
  matrix[row * 3] * point[0] + matrix[row * 3 + 1] * point[1] + matrix[row * 3 + 2] * point[2]);
const identity = [1, 0, 0, 0, 1, 0, 0, 0, 1];
function rotate(point: readonly number[], axis: 'x' | 'y' | 'z', degrees: number) {
  const c = Math.cos(degrees * Math.PI / 180), s = Math.sin(degrees * Math.PI / 180), [x, y, z] = point;
  return axis === 'x' ? [x, c * y - s * z, s * y + c * z]
    : axis === 'y' ? [c * x + s * z, y, -s * x + c * z] : [c * x - s * y, s * x + c * y, z];
}

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

test('prepared destination correction preserves close-range framing when the globe radius changes', async () => {
  const read = async (path: string) => JSON.parse(await readFile(new URL(path, import.meta.url), 'utf8'));
  const scene = await read('../../../../../../src/objects/earth/prepared/scene.json');
  const config = await read('../../../../../../src/objects/earth/source/preparation/paged-ellipsoid.json');
  const body = scene[config.sceneBodyKey];
  const point = prepareLocationPoint(scene, -58.3816, -34.6037);
  const destination = prepareLocationCamera(scene, point, 2048, { body, camera: config.camera });
  // The retained body and mesh nodes carry one solved bodyMatrix (#294); prepareLocationCamera
  // maps a geographic point into the scene through the same matrix.
  const m = body.bodyMatrix;
  let local = apply(m, point);
  local = rotate(local, 'y', destination.controlYaw);
  local = rotate(local, 'x', preparedScenePitch(destination.controlPitch, config.camera));
  local = local.map(value => value * config.camera.sceneScale);
  assert.ok(Math.hypot(local[0], local[1]) < 1e-10);
  // Desktop shell framing at 1400×1000, with the eye just outside the
  // current authored globe. Radius changes must not invalidate this oracle.
  const focal = 1212.44, offset = [-170, 0], depth = Math.hypot(...local) * 1.000004;
  const centre = [-offset[0] * depth / focal, 0, -depth];
  const project = (rotation: readonly number[]) => {
    const q = apply(rotation, local).map((value, axis) => value + centre[axis]);
    return [870 + offset[0] + focal * q[0] / -q[2], 500 + focal * q[1] / -q[2]];
  };
  const corrected = project(prepareSurfaceTargetRotation(centre));
  assert.ok(Math.abs(corrected[0] - (870)) < 10 ** -8 / 2, `${corrected[0]} is not close to ${870}`); assert.ok(Math.abs(corrected[1] - (500)) < 10 ** -8 / 2, `${corrected[1]} is not close to ${500}`);
  assert.ok(!(Math.abs(project(identity)[0] - (870)) < 10 ** -8 / 2));
  assert.equal(destination.zoom, 2048);
});
