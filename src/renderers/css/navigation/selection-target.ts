import type { PositionM } from '@cssearth/engine';
import type { PreparedWorldCameraFrame, WorldCameraPose, WorldCameraViewport } from './world-camera.js';
import { worldQuaternionFromRotation, worldRotationFromQuaternion, rotateWorldPosition } from './world-camera-math.js';
import { distanceForSilhouetteRadius } from '../solar-system/heliocentric-geometry.js';

/** Selection follows the measured departure ray, with a north-up arrival.
 * The CSS viewport supplies the approach framing instead of a fixed field of view. */
export function createWorldSelectionTarget(from: WorldCameraPose, frame: PreparedWorldCameraFrame,
  viewport: WorldCameraViewport & { framingRadiusPixels: number }): WorldCameraPose {
  if (from.referenceFrame !== frame.referenceFrame || from.epochJdTt !== frame.epochJdTt) {
    throw new TypeError('Selection requires a common reference frame and prepared epoch.');
  }
  const sourceRotation = worldRotationFromQuaternion(from.pose.orientationXyzw);
  const up = frame.orbitUpReference ?? rotateWorldPosition(sourceRotation, [0, -1, 0]);
  const offset: PositionM = [from.pose.positionM[0] - frame.originM[0],
    from.pose.positionM[1] - frame.originM[1], from.pose.positionM[2] - frame.originM[2]];
  // Keep the viewing latitude. Flattening this ray into the orbital plane
  // introduces an unsolicited dive while the flight independently turns to face it.
  const direction = unit(offset);
  const radius = viewport.framingRadiusPixels;
  const range = distanceForSilhouetteRadius(frame.bodyRadiusM, viewport.focalPixels,
    radius, viewport.principalOffsetPixels);
  const referenceBasis = basis(direction, scale(up, -1));
  // Keep the selected object at the same content centre on an off-axis shell.
  const eyeBackward = unit([viewport.principalOffsetPixels[0], viewport.principalOffsetPixels[1], viewport.focalPixels]);
  const eyeBasis = basis(eyeBackward, [0, 1, 0]);
  const rotation = [0, 1, 2].flatMap(row => [0, 1, 2].map(column =>
    referenceBasis[row * 3] * eyeBasis[column * 3] +
    referenceBasis[row * 3 + 1] * eyeBasis[column * 3 + 1] +
    referenceBasis[row * 3 + 2] * eyeBasis[column * 3 + 2]));
  return Object.freeze({ referenceFrame: frame.referenceFrame, epochJdTt: frame.epochJdTt,
    pose: Object.freeze({ positionM: Object.freeze([frame.originM[0] + direction[0] * range,
      frame.originM[1] + direction[1] * range, frame.originM[2] + direction[2] * range] as const),
      orientationXyzw: worldQuaternionFromRotation(rotation) }) });
}

function basis(back: PositionM, downHint: PositionM) {
  let right = cross(downHint, back);
  if (Math.hypot(...right) < 1e-10) right = cross(Math.abs(back[0]) < .9 ? [1, 0, 0] : [0, 1, 0], back);
  right = unit(right);
  const down = cross(back, right);
  return [right[0], down[0], back[0], right[1], down[1], back[1], right[2], down[2], back[2]];
}
function scale(a: PositionM, k: number): PositionM { return [a[0] * k, a[1] * k, a[2] * k]; }
function cross(a: PositionM, b: PositionM): PositionM { return [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]]; }
function unit(a: PositionM): PositionM {
  const length = Math.hypot(...a);
  if (!(length > 0)) throw new TypeError('Selection direction is undefined.');
  return scale(a, 1 / length);
}
