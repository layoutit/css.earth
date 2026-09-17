import { expect, test } from 'vitest';
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
  [200,100,-2000].forEach((value, index) => expect(presentation.bodyCenterUnits[index]).toBeCloseTo(value, 9));
  [0,-1,0,1,0,0,0,0,1].forEach((value, index) => expect(presentation.rotation[index]).toBeCloseTo(value, 12));
  expect(() => savedWorldCamera({ ...saved, preparedEpochJdTt: 2 }, frame, viewport)).toThrow('epoch');
});
test('existing centred links keep their authored off-axis centre', () => {
  const saved: SharedView = { preparedEpochJdTt: 1,
    camera: { distanceKilometers: 200, pose: { schema: 'cssearth-camera-pose@2', scene: 'matrix3d(1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1)' } },
    playback: { times: [], speed: 1, motionRequested: false } };
  const presentation = presentWorldCamera(savedWorldCamera(saved, frame, viewport), frame, viewport);
  expect(presentation.distanceM).toBeCloseTo(200000, 5);
  expect(presentation.centerPixels![0]).toBeCloseTo(0, 8);
  expect(presentation.centerPixels![1]).toBeCloseTo(0, 8);
});
