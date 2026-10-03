import assert from 'node:assert/strict';
import test from 'node:test';
import { CAMERA_POSE_SCHEMA, parseCameraPose, parseCameraPoseMatrix, parseRestoredCameraPose } from './camera-pose.js';

const identity = 'matrix3d(1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1)';
const pose = (scene: unknown = identity) => ({ schema: CAMERA_POSE_SCHEMA, scene });
const invalidLink = { name: 'Error', message: 'Invalid “pose” in this view link.' };
const invalidRestore = { name: 'TypeError', message: 'Camera camera scene matrix is invalid.' };

test('camera snapshot identifier and exact saved strings remain unchanged', () => {
  assert.equal(CAMERA_POSE_SCHEMA, 'cssearth-camera-pose@2');
  for (const scene of [identity,
    'matrix3d(0.951326031283,0.251717501181,-0.177811928175,0,0.137478049482,0.169758540011,0.975849283447,0,0.275823436483,-0.952796063013,0.126890087063,0,0,0,0,1)',
    'matrix3d(0.133333,0.933333,-0.333333,0,-0.666667,0.333333,0.666667,0,0.733333,0.133333,0.666667,0,0,0,0,1)',
    'matrix3d(+1e0,0,0,0,0,1.,0,0,0,0,1,0,0,0,0,1)']) {
    assert.deepEqual(parseCameraPose(pose(scene)), pose(scene));
    assert.deepEqual(parseCameraPoseMatrix(scene), parseRestoredCameraPose(pose(scene)));
  }
});

test('share-link matrix admission rejects nonrotations and pins each geometric constraint', () => {
  for (const scene of ['rotateX(45deg)', 'matrix3d(1)',
    'matrix3d(2,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1)',
    'matrix3d(-1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1)',
    'matrix3d(,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1)',
    'matrix3d(0x1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1)',
    'matrix3d(Infinity,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1)',
    'matrix3d(1e999,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1)',
    `matrix3d(${ ' '.repeat(1024) }1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1)`]) {
    assert.throws(() => parseCameraPose(pose(scene)), invalidLink);
  }
  for (const index of [3, 7, 11, 12, 13, 14, 15]) {
    const matrix = parseCameraPoseMatrix(identity);
    matrix[index] += 1e-5;
    assert.throws(() => parseCameraPoseMatrix(`matrix3d(${matrix.join(',')})`), invalidLink);
  }
  const shear = parseCameraPoseMatrix(identity); shear[1] = 0.01;
  assert.throws(() => parseCameraPoseMatrix(`matrix3d(${shear.join(',')})`), invalidLink);
  for (const value of [null, [], {}, { ...pose(), schema: 'retired' }, { ...pose(), skybox: identity }, pose(1)]) {
    assert.throws(() => parseCameraPose(value), invalidLink);
  }
});

test('live restore preserves its finite-matrix admission and historical diagnostics', () => {
  // Restore projects to a rotation in renderer; stricter share-link admission would change its behavior.
  for (const scene of ['matrix3d(2,0,0,0,0,1,0,0,0,0,1,0,10,0,0,1)',
    'matrix3d(0x1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1)',
    'matrix3d(,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1)']) {
    assert.equal(parseRestoredCameraPose({ ...pose(scene), extra: true }).length, 16);
    assert.throws(() => parseCameraPose(pose(scene)), invalidLink);
  }
  for (const value of [null, {}, { ...pose(), schema: 'retired' }]) {
    assert.throws(() => parseRestoredCameraPose(value), { name: 'TypeError', message: 'Physical camera pose is invalid.' });
  }
  for (const scene of [null, 1, '', 'matrix3d(1)', 'matrix3d((1))',
    'matrix3d(NaN,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1)']) {
    assert.throws(() => parseRestoredCameraPose(pose(scene)), invalidRestore);
  }
});
