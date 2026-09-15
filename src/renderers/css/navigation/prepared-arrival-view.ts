import { requireCamera } from '../validation/camera-controls.js';
import { preparedSceneMatrix } from './prepared-camera-basis.js';
import type { WorldRotation } from './world-camera-math.js';

/** Reuse the exact package pose used by a fresh mount; catalogue preparation calls this once. */
export function preparedDefaultViewRotation(camera: unknown): WorldRotation {
  requireCamera(camera);
  const matrix = preparedSceneMatrix(camera, camera.defaultControlPitchDegrees, camera.defaultControlYawDegrees);
  return [matrix[0], matrix[4], matrix[8], matrix[1], matrix[5], matrix[9], matrix[2], matrix[6], matrix[10]];
}
