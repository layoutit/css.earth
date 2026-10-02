import { cameraProjectionScale, worldCameraFocusFrame as focusFrame, validateWorldCameraViewport as validateViewport } from '@cssearth/objects';
import type { WorldCameraPose, LocalWorldCameraPresentation } from '@cssearth/objects';
import { cameraPoseFromReferenceFrame } from '@cssearth/engine';
import type { PositionM } from '@cssearth/engine';
import { silhouetteEllipse } from '@cssearth/engine';
import type { SilhouetteEllipse } from '@cssearth/engine';
import {
  flipWorldRotationY, rotateWorldPosition, scaleWorldPosition, transposeWorldRotation,
  worldRotationCss, worldRotationFromQuaternion,
} from '@cssearth/engine';

import type { PreparedWorldCameraFrame } from '@cssearth/objects';

export interface WorldCameraViewport {
  readonly focalPixels: number;
  /** Scale already included in focalPixels. */
  readonly projectionScale?: number;
  /** Measured layout dimensions, transported with the camera rather than read after frame writes. */
  readonly widthPixels?: number;
  readonly heightPixels?: number;
  /** Relative to the selected presentation root centre, in CSS pixels. */
  readonly principalOffsetPixels: readonly [number, number];
  /** The top band of the stage the shell header covers, in CSS pixels: scene labels stay below it. */
  readonly coveredTopPixels?: number;
}

/** Resolve the camera lens once, including when a different scene supplied the viewport. */
export function worldCameraViewport<T extends WorldCameraViewport>(world: Pick<WorldCameraPose, 'projectionScale'>, viewport: T): T {
  const scale = cameraProjectionScale(world.projectionScale);
  const previous = cameraProjectionScale(viewport.projectionScale);
  return scale === previous ? viewport : { ...viewport, focalPixels: viewport.focalPixels * scale / previous, projectionScale: scale };
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

/** Resolve one observer into any selected object's prepared presentation. No camera or DOM is allocated. */
export function presentWorldCamera(world: WorldCameraPose, frame: PreparedWorldCameraFrame, viewport: WorldCameraViewport): WorldCameraPresentation {
  viewport = worldCameraViewport(world, viewport);
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
