import type { PositionM } from '@cssearth/engine';
import { type WorldCameraPose, type PreparedWorldCameraFrame } from '@cssearth/objects';
import type { WorldCameraViewport } from './world-camera.js';
import { cssCameraAxesFromOrientation, rotateWorldPosition } from '@cssearth/engine';
import { distanceForSilhouetteRadius } from '@cssearth/engine';

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
  const offset = Object.freeze([direction[0] * range, direction[1] * range, direction[2] * range] as const);
  return Object.freeze({ referenceFrame: frame.referenceFrame, epochJdTt: frame.epochJdTt,
    ...(from.projectionScale === undefined ? {} : { projectionScale: from.projectionScale }),
    // The pose keeps its exact offset from the body beside the world position, which cannot hold it for a small, far body.
    pose: Object.freeze({ positionM: Object.freeze([frame.originM[0] + offset[0], frame.originM[1] + offset[1], frame.originM[2] + offset[2]] as const),
      orientationXyzw: Object.freeze([...from.pose.orientationXyzw] as const), focusOffset: Object.freeze({ originM: frame.originM, offsetM: offset }) }) });
}

function unit(a: PositionM): PositionM {
  const length = Math.hypot(...a);
  if (!(length > 0)) throw new TypeError('Selection direction is undefined.');
  return [a[0] / length, a[1] / length, a[2] / length];
}
