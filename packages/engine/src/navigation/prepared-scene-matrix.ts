import type { PitchCalibration } from './math-types.js';
import { preparedScenePitch } from './camera-math.js';
import type { Matrix4 } from '../solar-system/types.js';
import { multiplyPreparedMatrix4, preparedRotationMatrix4 } from '@cssearth/core';

/** The authored camera calibration, shared by native publication and live orbiting. */
export function preparedSceneMatrix(camera: PitchCalibration, pitch: number, yaw: number): Matrix4 {
  return multiplyPreparedMatrix4(preparedRotationMatrix4('x', preparedScenePitch(pitch, camera)), preparedRotationMatrix4('y', yaw));
}
