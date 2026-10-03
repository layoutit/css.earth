import type { PitchCalibration } from './math-types.js';
import type { WorldRotation } from '@cssearth/core';

import { preparedSceneMatrix } from './prepared-scene-matrix.js';

/** Reuse the exact package pose used by a fresh mount; catalogue preparation calls this once. */
export function preparedDefaultViewRotation(camera: PitchCalibration & { readonly defaultControlYawDegrees: number }): WorldRotation {
  const matrix = preparedSceneMatrix(camera, camera.defaultControlPitchDegrees, camera.defaultControlYawDegrees);
  return [matrix[0], matrix[4], matrix[8], matrix[1], matrix[5], matrix[9], matrix[2], matrix[6], matrix[10]];
}
