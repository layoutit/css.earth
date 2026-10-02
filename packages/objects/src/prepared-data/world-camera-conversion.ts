import { validateWorldReflection, validateWorldRotation, type WorldRotation } from '../registry/world-rotation.js';
import type { PreparedWorldCameraFrame } from './world-frame.js';
import { cameraPoseToReferenceFrame, offAxisFrame, flipWorldRotationY, referenceRotationFromPresentation, rotateWorldPosition, scaleWorldPosition, transposeWorldRotation, validateWorldPosition, worldQuaternionFromRotation } from '@cssearth/engine';
import type { FocusFrame, PhysicalCameraPose, PositionM } from '@cssearth/engine';

export interface WorldCameraPose {
  readonly referenceFrame: string;
  readonly epochJdTt: number;
  /** Camera-to-reference orientation of right-handed camera axes (+x right, +y up, +z toward the eye): the CSS camera axes with y
   * reversed, since CSS 3D space is left-handed and a quaternion carries only proper rotations. */
  readonly pose: PhysicalCameraPose;
  /** Optical framing relative to the prepared viewport dataset; 1 keeps its original field of view. */
  readonly projectionScale?: number;
}

export interface LocalWorldCameraPresentation {
  /** Presentation-frame directions to CSS eye-space directions, row-major. */
  readonly rotation: WorldRotation;
  /** Object centre relative to the eye; CSS looks down -z. */
  readonly bodyCenterUnits: PositionM;
}

export interface PreparedWorldCameraViewport {
  readonly focalPixels: number;
  readonly projectionScale?: number;
  readonly principalOffsetPixels: readonly [number, number];
}

export function cameraProjectionScale(value = 1): number {
  if (!Number.isFinite(value) || value <= 0) throw new TypeError('Camera projection scale must be positive and finite.');
  return value;
}

/** Capture the existing centred physical dolly, including its off-axis eye. */
export function worldCameraFromCenteredPresentation(
  local: { readonly rotation: WorldRotation; readonly distanceUnits: number },
  frame: PreparedWorldCameraFrame,
  viewport: PreparedWorldCameraViewport,
): WorldCameraPose {
  validateWorldCameraViewport(viewport);
  if (!Number.isFinite(local.distanceUnits) || local.distanceUnits <= 0) throw new TypeError('Camera distance must be positive scene units.');
  const axis = offAxisFrame(viewport.focalPixels, viewport.principalOffsetPixels);
  return worldCameraFromPresentation({ rotation: local.rotation, bodyCenterUnits: [
    local.distanceUnits * axis.sinTheta * axis.radial[0],
    local.distanceUnits * axis.sinTheta * axis.radial[1],
    -local.distanceUnits * axis.cosTheta,
  ] }, frame, viewport.projectionScale);
}

/** Reverse the full translated presentation; unlike the centred dolly this does not re-aim the observer. */
export function worldCameraFromPresentation(local: LocalWorldCameraPresentation, frame: PreparedWorldCameraFrame, projectionScale = 1): WorldCameraPose {
  const focus = worldCameraFocusFrame(frame);
  validateWorldRotation(local.rotation);
  validateWorldPosition(local.bodyCenterUnits);
  const cameraToPresentation = transposeWorldRotation(local.rotation);
  const [x, y, z] = scaleWorldPosition(rotateWorldPosition(cameraToPresentation, local.bodyCenterUnits), -frame.metersPerUnit);
  // The focus frame is the presentation's y-up twin: both the position and the camera axes cross into it with y reversed.
  const pose = cameraPoseToReferenceFrame({
    positionM: [x, -y, z],
    orientationXyzw: worldQuaternionFromRotation(flipWorldRotationY(cameraToPresentation)),
  }, focus);
  cameraProjectionScale(projectionScale);
  return Object.freeze({ referenceFrame: frame.referenceFrame, epochJdTt: frame.epochJdTt, pose,
    ...(projectionScale === 1 ? {} : { projectionScale }) });
}

export function worldCameraFocusFrame(frame: PreparedWorldCameraFrame): FocusFrame {
  if (typeof frame.referenceFrame !== 'string' || frame.referenceFrame.length === 0 ||
      !Number.isFinite(frame.epochJdTt) || !Number.isFinite(frame.metersPerUnit) || frame.metersPerUnit <= 0 ||
      !Number.isFinite(frame.bodyRadiusM) || frame.bodyRadiusM <= 0) throw new TypeError('Prepared world frame metadata is invalid.');
  validateWorldPosition(frame.originM);
  validateWorldReflection(frame.presentationToReference);
  return { originM: frame.originM, localToReferenceXyzw: worldQuaternionFromRotation(referenceRotationFromPresentation(frame.presentationToReference)) };
}

export function validateWorldCameraViewport(viewport: PreparedWorldCameraViewport): void {
  if (!Number.isFinite(viewport.focalPixels) || viewport.focalPixels <= 0 ||
      viewport.principalOffsetPixels.length !== 2 || !viewport.principalOffsetPixels.every(Number.isFinite)) {
    throw new TypeError('World camera viewport must contain a positive focal length and finite principal point.');
  }
}
