import assert from 'node:assert/strict';
import test from 'node:test';
import { worldCameraFromCenteredPresentation, worldCameraFromPresentation } from './world-camera-conversion.js';
import type { WorldCameraFrame } from './world-camera-conversion.js';
import type { WorldRotation } from '@cssearth/core';

const rotation: WorldRotation = [1, 0, 0, 0, 1, 0, 0, 0, 1];
const frame: WorldCameraFrame = { referenceFrame: 'ICRF', epochJdTt: 2451545,
  originM: [0, 0, 0], presentationToReference: [1, 0, 0, 0, -1, 0, 0, 0, 1],
  metersPerUnit: 2, bodyRadiusM: 1 };
const viewport = { focalPixels: 1000, principalOffsetPixels: [0, 0] as const };

test('conversion preserves the reference pose, physical scale and default projection serialization', () => {
  const local = { rotation, bodyCenterUnits: [0, 0, -10] as const };
  const pose = worldCameraFromPresentation(local, frame);
  assert.deepEqual(pose.pose.positionM, [0, 0, 20]);
  assert.deepEqual(pose.pose.orientationXyzw, [0, 0, 0, 1]);
  assert.equal(pose.referenceFrame, frame.referenceFrame);
  assert.equal(pose.epochJdTt, frame.epochJdTt);
  assert.ok(!Object.hasOwn(pose, 'projectionScale'));
  assert.equal(worldCameraFromPresentation(local, frame, 2).projectionScale, 2);
  assert.deepEqual(worldCameraFromCenteredPresentation({ rotation, distanceUnits: 10 }, frame, viewport), pose);
  assert.ok(Object.isFrozen(pose));
});

test('conversion validates the authored frame, presentation, dolly and viewport before publishing a pose', () => {
  const local = { rotation, bodyCenterUnits: [0, 0, -10] as const };
  assert.throws(() => worldCameraFromPresentation(local, { ...frame, metersPerUnit: 0 }), /Prepared world frame metadata is invalid\./);
  assert.throws(() => worldCameraFromPresentation(local, { ...frame, presentationToReference: rotation }), /must reverse handedness/);
  assert.throws(() => worldCameraFromPresentation({ ...local, rotation: [2, 0, 0, 0, 1, 0, 0, 0, 1] }, frame), /must be orthonormal/);
  assert.throws(() => worldCameraFromPresentation({ ...local, bodyCenterUnits: [NaN, 0, 0] }, frame), TypeError);
  assert.throws(() => worldCameraFromPresentation(local, frame, 0), /Camera projection scale must be positive and finite\./);
  assert.throws(() => worldCameraFromCenteredPresentation({ rotation, distanceUnits: 0 }, frame, viewport), /Camera distance must be positive scene units\./);
  assert.throws(() => worldCameraFromCenteredPresentation({ rotation, distanceUnits: 10 }, frame, { ...viewport, focalPixels: 0 }), /World camera viewport must contain a positive focal length and finite principal point\./);
});
