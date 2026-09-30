import { test } from 'node:test';
import assert from 'node:assert/strict';
import { isDeepStrictEqual } from 'node:util';
import { savedWorldCamera } from './saved-world-camera.js';
import { presentWorldCamera } from './world-camera.js';
import type { PreparedWorldCameraFrame } from './world-camera.js';
import type { SharedView } from './view-url.js';

const frame: PreparedWorldCameraFrame = { referenceFrame: 'world', epochJdTt: 1,
  originM: [1e8, -2e7, 3e9], presentationToReference: [1, 0, 0, 0, -1, 0, 0, 0, 1], metersPerUnit: 100, bodyRadiusM: 1000 };
const viewport = { focalPixels: 1000, principalOffsetPixels: [-170,0] as const };
test('Back resolves translated camera coordinates before its flight, including arbitrary roll', () => {
  const saved: SharedView = { preparedEpochJdTt: 1,
    camera: { distanceKilometers: Math.hypot(20, 10, 200), bodyCenterKilometers: [20,10,-200],
      pose: { schema: 'cssearth-camera-pose@2', scene: 'matrix3d(0,1,0,0,-1,0,0,0,0,0,1,0,0,0,0,1)' } },
    playback: { times: [1234], speed: 1, motionRequested: false } };
  const presentation = presentWorldCamera(savedWorldCamera(saved, frame, viewport), frame, viewport);
  [200,100,-2000].forEach((value, index) => assert.ok(Math.abs(presentation.bodyCenterUnits[index] - (value)) < 10 ** -9 / 2, `${presentation.bodyCenterUnits[index]} is not close to ${value}`));
  [0,-1,0,1,0,0,0,0,1].forEach((value, index) => assert.ok(Math.abs(presentation.rotation[index] - (value)) < 10 ** -12 / 2, `${presentation.rotation[index]} is not close to ${value}`));
  assert.throws(() => savedWorldCamera({ ...saved, preparedEpochJdTt: 2 }, frame, viewport), /epoch/);
});
test('existing centred links keep their authored off-axis centre', () => {
  const saved: SharedView = { preparedEpochJdTt: 1,
    camera: { distanceKilometers: 200, pose: { schema: 'cssearth-camera-pose@2', scene: 'matrix3d(1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1)' } },
    playback: { times: [], speed: 1, motionRequested: false } };
  const presentation = presentWorldCamera(savedWorldCamera(saved, frame, viewport), frame, viewport);
  assert.ok(Math.abs(presentation.distanceM - (200000)) < 10 ** -5 / 2, `${presentation.distanceM} is not close to ${200000}`);
  assert.ok(Math.abs(presentation.centerPixels![0] - (0)) < 10 ** -8 / 2, `${presentation.centerPixels![0]} is not close to ${0}`);
  assert.ok(Math.abs(presentation.centerPixels![1] - (0)) < 10 ** -8 / 2, `${presentation.centerPixels![1]} is not close to ${0}`);
});
