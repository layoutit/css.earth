import { test } from 'node:test';
import assert from 'node:assert/strict';
import scene from '../../../../src/objects/mercury/prepared/scene.json' with { type: 'json' };
import { createPreparedCamera } from './prepared-camera.js';

test('a scene with a wider one to hand the camera to lets the zoom go past its own far limit', () => {
  const frame = { referenceFrame: 'sun-icrf', epochJdTt: 1, originM: [0, 0, 0] as const, presentationToReference: [1, 0, 0, 0, 1, 0, 0, 0, 1],
    metersPerUnit: 2, bodyRadiusM: 200 };
  const camera = createPreparedCamera(scene.camera as never, { frame, bodyRadiusUnits: 100, maximumExtentUnits: 400, kilometersPerUnit: .002 } as never,
    () => ({ focalPixels: 1000, principalOffsetPixels: [0, 0] as const }), null,
    // The far limit is about distance alone: the orientation owner needs a DOMMatrix, which this test has no use for.
    (() => ({ sceneMatrix: () => '', snapshot: () => ({}), scene: () => ({}), rotate() {}, setSceneRotation() {}, restore() {}, reset() {}, rebaseScene() {},
      prepareFlight: () => ({ angularDistance: 0, sample() {} }) })) as never);
  const limit = camera.maximumDistance;
  camera.dolly({ distance: limit * 8 });
  assert.equal(camera.state.distance, limit, 'a scene with nowhere wider to go stops the zoom at its far limit');
  camera.setZoomOutOpen(true);
  camera.dolly({ distance: limit * 8 });
  assert.equal(camera.state.distance, limit * 8, 'with a wider scene to take the camera, the zoom goes on');
  assert.ok(camera.minimumZoom() <= camera.state.zoom, 'and the zoom range reaches that far');
  camera.setZoomOutOpen(false);
  camera.dolly({ distance: limit * 16 });
  assert.equal(camera.state.distance, limit, 'the limit binds again once the scene has nowhere wider to go');
});
