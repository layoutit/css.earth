import test from 'node:test';
import assert from 'node:assert/strict';
import { shapeCloudPhotoPose, shapeCloudImageAxes } from './shape-cloud-photo-pose.js';
import { shapeCloudCamera } from '../../adapters/viewer/shape-cloud-camera';
import { preparedVolumeCameraTransform } from '../../adapters/viewer/camera-reference';
import type { PreparedCssVolume } from '../../adapters/viewer/camera-reference';

const frame: PreparedCssVolume['frame'] = { referenceFrame: 'lab-sky-west-north-toward', epochJdTt: 2451545, originM: [0, 0, 0],
  localToReferenceXyzw: [0, 0, 0, 1], metersPerUnit: 1, boundsUnits: { min: [-5, -5, -5], max: [5, 5, 5] } };
const image = { width: 768, height: 534, unitsPerPixel: 10 / 768 };
test('flat photo corners follow the actual cloud camera through compound yaw and pitch', () => {
  for (const [yaw, pitch] of [[0, 0], [40, 28], [90, -30], [140, 72], [-52, -48], [180, 0]]) {
    const publication = shapeCloudCamera(frame, image, image, { zoom: 1 / .94, panX: 0, panY: 0 }, yaw!, pitch!);
    const { rotation: r, translationCssPixels: t, focalPixels } = preparedVolumeCameraTransform(publication, frame);
    const matrix = shapeCloudPhotoPose(image.width, image.height, yaw!, pitch!);
    for (const [x, y] of [[0, 0], [768, 0], [0, 534], [768, 534], [384, 267], [180, 430]]) {
      const point = [(image.height / 2 - y!) * image.unitsPerPixel * 50, (x! - image.width / 2) * image.unitsPerPixel * 50, 0];
      const eye = [0, 1, 2].map(row => r[row * 3]! * point[0]! + r[row * 3 + 1]! * point[1]! + t[row]!);
      const projected = [image.width / 2 + eye[0]! * focalPixels / (focalPixels - eye[2]!), image.height / 2 + eye[1]! * focalPixels / (focalPixels - eye[2]!)];
      const flat = [matrix[0] * x! + matrix[2] * y! + matrix[4], matrix[1] * x! + matrix[3] * y! + matrix[5]];
      assert.ok(Math.hypot(flat[0]! - projected[0]!, flat[1]! - projected[1]!) < .04, `Photo/cloud projection diverged at ${yaw},${pitch}.`);
    }
  }
  assert.deepEqual(shapeCloudPhotoPose(768, 534, 0, 0), [1, 0, 0, 1, 0, 0]);
  const edge = shapeCloudPhotoPose(768, 534, 90, 0); assert.ok(Math.abs(edge[0] * edge[3] - edge[1] * edge[2]) < 1e-10);
});
test('triad uses source axes, registered screen orientation and the correct Earth-facing depth sign', () => {
  const earth = shapeCloudImageAxes(0, 0, [1, 0, 0, 1, 0, 0]);
  assert.deepEqual(earth[0]!.screen, [1, 0]); assert.deepEqual(earth[1]!.screen, [0, 1]);
  assert.equal(Math.hypot(...earth[2]!.screen), 0); assert.equal(earth[2]!.towardEye, 1);
  const camera = shapeCloudCamera(frame, image, image, { zoom: 1, panX: 0, panY: 0 }, 0, 0);
  assert.ok(camera.world.pose.positionM[2] > 0, 'Earth-view camera must lie on prepared physical +Z (toward).');
  const back = shapeCloudImageAxes(180, 0, [1, 0, 0, 1, 0, 0]); assert.equal(back[2]!.towardEye, -1);
  const registered = shapeCloudImageAxes(0, 0, [0, 2, -2, 0, 100, 60]);
  assert.deepEqual(registered[0]!.screen, [0, 1]); assert.deepEqual(registered[1]!.screen, [-1, 0]);
  for (const [yaw, pitch] of [[0, 0], [35, 27], [90, -30], [-52, -48]]) {
    const axes = shapeCloudImageAxes(yaw!, pitch!, [1, 0, 0, 1, 0, 0]);
    const posed = shapeCloudCamera(frame, image, image, { zoom: 1, panX: 0, panY: 0 }, yaw!, pitch!);
    const { rotation: r } = preparedVolumeCameraTransform(posed, frame);
    // Physical [X, -Y, +Z] maps to the retained renderer's swapped [Y, X, Z] basis.
    const actual = [[r[1]!, r[4]!, r[7]!], [-r[0]!, -r[3]!, -r[6]!], [r[2]!, r[5]!, r[8]!]];
    for (let i = 0; i < 3; i++) assert.ok(Math.hypot(...[...axes[i]!.screen, axes[i]!.towardEye].map((n, j) => n - actual[i]![j]!)) < 1e-10);
  }
});
