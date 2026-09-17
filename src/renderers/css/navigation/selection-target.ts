import type { PositionM } from '@cssearth/engine';
import type { PreparedWorldCameraFrame, WorldCameraPose, WorldCameraViewport } from './world-camera.js';
import { cssCameraAxesFromOrientation, rotateWorldPosition } from './world-camera-math.js';
import { distanceForSilhouetteRadius } from '../solar-system/heliocentric-geometry.js';

/** Center and frame the body without resetting the current viewing direction or roll. */
export function createWorldSelectionTarget(from: WorldCameraPose, frame: PreparedWorldCameraFrame,
  viewport: WorldCameraViewport & { framingRadiusPixels: number }): WorldCameraPose {
  if (from.referenceFrame !== frame.referenceFrame || from.epochJdTt !== frame.epochJdTt) {
    throw new TypeError('Selection requires a common reference frame and prepared epoch.');
  }
  // The principal offset is in CSS pixels, +y down.
  const sourceRotation = cssCameraAxesFromOrientation(from.pose.orientationXyzw);
  const direction = unit(rotateWorldPosition(sourceRotation,
    [viewport.principalOffsetPixels[0], viewport.principalOffsetPixels[1], viewport.focalPixels]));
  const radius = viewport.framingRadiusPixels;
  const range = distanceForSilhouetteRadius(frame.bodyRadiusM, viewport.focalPixels,
    radius, viewport.principalOffsetPixels);
  return Object.freeze({ referenceFrame: frame.referenceFrame, epochJdTt: frame.epochJdTt,
    pose: Object.freeze({ positionM: Object.freeze([frame.originM[0] + direction[0] * range,
      frame.originM[1] + direction[1] * range, frame.originM[2] + direction[2] * range] as const),
      orientationXyzw: Object.freeze([...from.pose.orientationXyzw] as const) }) });
}

function unit(a: PositionM): PositionM {
  const length = Math.hypot(...a);
  if (!(length > 0)) throw new TypeError('Selection direction is undefined.');
  return [a[0] / length, a[1] / length, a[2] / length];
}
