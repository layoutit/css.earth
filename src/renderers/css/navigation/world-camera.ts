import { cameraPoseFromReferenceFrame, cameraPoseToReferenceFrame } from '@cssearth/engine';
import type { FocusFrame, PhysicalCameraPose, PositionM } from '@cssearth/engine';
import { offAxisFrame, silhouetteEllipse } from '../solar-system/heliocentric-geometry.js';
import type { SilhouetteEllipse } from '../solar-system/types.js';
import {
  flipWorldRotationY, referenceRotationFromPresentation, rotateWorldPosition, scaleWorldPosition, transposeWorldRotation, validateWorldPosition,
  validateWorldReflection, validateWorldRotation, worldQuaternionFromRotation, worldRotationCss, worldRotationFromQuaternion,
} from './world-camera-math.js';
import type { WorldRotation } from './world-camera-math.js';

/** Prepared/resolved frame facts. No ephemeris or body geometry is derived here. */
export interface PreparedWorldCameraFrame {
  readonly referenceFrame: string;
  readonly epochJdTt: number;
  readonly originM: PositionM;
  /** CSS presentation directions to reference directions: a reflection, since CSS 3D space is left-handed. */
  readonly presentationToReference: WorldRotation;
  readonly metersPerUnit: number;
  readonly bodyRadiusM: number;
  readonly orbitUpReference?: PositionM;
}

export interface WorldCameraPose {
  readonly referenceFrame: string;
  readonly epochJdTt: number;
  /** Camera-to-reference orientation of right-handed camera axes (+x right, +y up, +z toward the eye): the CSS camera axes with y
   * reversed, since CSS 3D space is left-handed and a quaternion carries only proper rotations. */
  readonly pose: PhysicalCameraPose;
}

export interface WorldCameraViewport {
  readonly focalPixels: number;
  /** Measured layout dimensions, transported with the camera rather than read after frame writes. */
  readonly widthPixels?: number;
  readonly heightPixels?: number;
  /** Relative to the selected presentation root centre, in CSS pixels. */
  readonly principalOffsetPixels: readonly [number, number];
  /** The top band of the stage the shell header covers, in CSS pixels: scene labels stay below it. */
  readonly coveredTopPixels?: number;
}

export interface LocalWorldCameraPresentation {
  /** Presentation-frame directions to CSS eye-space directions, row-major. */
  readonly rotation: WorldRotation;
  /** Object centre relative to the eye; CSS looks down -z. */
  readonly bodyCenterUnits: PositionM;
}

export interface WorldCameraPresentation extends LocalWorldCameraPresentation {
  readonly sceneMatrix: string;
  readonly translateCssPixels: PositionM;
  readonly distanceUnits: number;
  readonly distanceM: number;
  readonly depthUnits: number;
  readonly centerPixels: readonly [number, number] | null;
  /** Null when the sphere intersects/leaves the forward image plane. */
  readonly silhouette: SilhouetteEllipse | null;
}

export function worldCameraSilhouetteDiameter(presentation: WorldCameraPresentation, radiusUnits: number): number {
  return 2 * (presentation.silhouette?.tangentialSemiAxis ?? (presentation.depthUnits > -radiusUnits ? Infinity : 0));
}

/** Capture the existing centred physical dolly, including its off-axis eye. */
export function worldCameraFromCenteredPresentation(
  local: { readonly rotation: WorldRotation; readonly distanceUnits: number },
  frame: PreparedWorldCameraFrame,
  viewport: WorldCameraViewport,
): WorldCameraPose {
  validateViewport(viewport);
  if (!Number.isFinite(local.distanceUnits) || local.distanceUnits <= 0) throw new TypeError('Camera distance must be positive scene units.');
  const axis = offAxisFrame(viewport.focalPixels, viewport.principalOffsetPixels);
  return worldCameraFromPresentation({ rotation: local.rotation, bodyCenterUnits: [
    local.distanceUnits * axis.sinTheta * axis.radial[0],
    local.distanceUnits * axis.sinTheta * axis.radial[1],
    -local.distanceUnits * axis.cosTheta,
  ] }, frame);
}

/** Reverse the full translated presentation; unlike the centred dolly this does not re-aim the observer. */
export function worldCameraFromPresentation(local: LocalWorldCameraPresentation, frame: PreparedWorldCameraFrame): WorldCameraPose {
  const focus = focusFrame(frame);
  validateWorldRotation(local.rotation);
  validateWorldPosition(local.bodyCenterUnits);
  const cameraToPresentation = transposeWorldRotation(local.rotation);
  const [x, y, z] = scaleWorldPosition(rotateWorldPosition(cameraToPresentation, local.bodyCenterUnits), -frame.metersPerUnit);
  // The focus frame is the presentation's y-up twin: both the position and the camera axes cross into it with y reversed.
  const pose = cameraPoseToReferenceFrame({
    positionM: [x, -y, z],
    orientationXyzw: worldQuaternionFromRotation(flipWorldRotationY(cameraToPresentation)),
  }, focus);
  return Object.freeze({ referenceFrame: frame.referenceFrame, epochJdTt: frame.epochJdTt, pose });
}

/** Resolve one observer into any selected object's prepared presentation. No camera or DOM is allocated. */
export function presentWorldCamera(world: WorldCameraPose, frame: PreparedWorldCameraFrame, viewport: WorldCameraViewport): WorldCameraPresentation {
  validateViewport(viewport);
  const focus = focusFrame(frame);
  if (world.referenceFrame !== frame.referenceFrame || world.epochJdTt !== frame.epochJdTt) {
    throw new TypeError('World camera and object must share a resolved reference frame and prepared epoch.');
  }
  const local = cameraPoseFromReferenceFrame(world.pose, focus);
  const rotation = flipWorldRotationY(transposeWorldRotation(worldRotationFromQuaternion(local.orientationXyzw)));
  const [px, py, pz] = local.positionM;
  const bodyCenterUnits = scaleWorldPosition(rotateWorldPosition(rotation, [px, -py, pz]), -1 / frame.metersPerUnit);
  const [x, y, z] = bodyCenterUnits;
  const distanceUnits = Math.hypot(x, y, z), depthUnits = -z;
  const [ox, oy] = viewport.principalOffsetPixels;
  const focal = viewport.focalPixels;
  const centerPixels: readonly [number, number] | null = depthUnits > 0
    ? [ox + focal * x / depthUnits, oy + focal * y / depthUnits] : null;
  const radiusUnits = frame.bodyRadiusM / frame.metersPerUnit;
  let silhouette: SilhouetteEllipse | null = null;
  if (depthUnits > radiusUnits && centerPixels !== null) {
    const radialLength = Math.hypot(x, y);
    const ellipse = silhouetteEllipse(radiusUnits, focal, distanceUnits, {
      radial: radialLength > 0 ? [x / radialLength, y / radialLength] : [0, 0],
      sinTheta: radialLength / distanceUnits, cosTheta: depthUnits / distanceUnits,
      tanTheta: radialLength / depthUnits,
    });
    silhouette = Object.freeze({ ...ellipse,
      centre: [centerPixels[0] + ellipse.centre[0], centerPixels[1] + ellipse.centre[1]],
    });
  }
  const translateCssPixels: PositionM = [ox + x, oy + y, focal + z];
  return Object.freeze({ rotation, bodyCenterUnits, sceneMatrix: worldRotationCss(rotation),
    translateCssPixels, distanceUnits,
    distanceM: distanceUnits * frame.metersPerUnit, depthUnits, centerPixels, silhouette,
  });
}

function focusFrame(frame: PreparedWorldCameraFrame): FocusFrame {
  if (typeof frame.referenceFrame !== 'string' || frame.referenceFrame.length === 0 ||
      !Number.isFinite(frame.epochJdTt) || !Number.isFinite(frame.metersPerUnit) || frame.metersPerUnit <= 0 ||
      !Number.isFinite(frame.bodyRadiusM) || frame.bodyRadiusM <= 0) throw new TypeError('Prepared world frame metadata is invalid.');
  validateWorldPosition(frame.originM);
  validateWorldReflection(frame.presentationToReference);
  return { originM: frame.originM, localToReferenceXyzw: worldQuaternionFromRotation(referenceRotationFromPresentation(frame.presentationToReference)) };
}

function validateViewport(viewport: WorldCameraViewport): void {
  if (!Number.isFinite(viewport.focalPixels) || viewport.focalPixels <= 0 ||
      viewport.principalOffsetPixels.length !== 2 || !viewport.principalOffsetPixels.every(Number.isFinite)) {
    throw new TypeError('World camera viewport must contain a positive focal length and finite principal point.');
  }
}
