import { worldCameraFromCenteredPresentation } from '../../../../src/renderers/css/navigation/world-camera';
import { worldRotationCss, worldRotationFromQuaternion, type WorldRotation } from '../../../../src/renderers/css/navigation/world-camera-math';
import { preparedVolumeCameraTransform } from '../../../../src/renderers/css/volume/prepared-volume-runtime';
import type { PreparedCssVolume, VolumeCameraPublication } from '../../../../src/renderers/css/volume/types';

export interface ShapeCloudFraming { zoom: number; panX: number; panY: number }
export const SHAPE_CLOUD_FOCAL_PIXELS = 1e7;

/** True orthographic CSS3D avoids Chromium's large-depth loss of tilted slices. */
export function shapeCloudOrthographicCamera(frame: PreparedCssVolume['frame'], image: { width: number; height: number; unitsPerPixel: number },
  viewport: { width: number; height: number }, framing: ShapeCloudFraming, yawDegrees: number, pitchDegrees: number) {
  const publication = shapeCloudCamera(frame, image, viewport, framing, yawDegrees, pitchDegrees);
  const { rotation } = preparedVolumeCameraTransform(publication, frame);
  const scale = Math.min(viewport.width / image.width, viewport.height / image.height) * .94 * framing.zoom / (50 * image.unitsPerPixel);
  const transform = `translate3d(${framing.panX}px,${framing.panY}px,0px) scale3d(${scale},${scale},${scale}) ${worldRotationCss(rotation)}`;
  return { publication, rotation, scale, transform };
}

/** Physical orientation transport for the shared optical stack policy; CSS placement is orthographic above. */
export function shapeCloudCamera(frame: PreparedCssVolume['frame'], image: { width: number; height: number; unitsPerPixel: number },
  viewport: { width: number; height: number }, framing: ShapeCloudFraming, yawDegrees: number, pitchDegrees: number): VolumeCameraPublication {
  const { width, height } = viewport;
  if (![width, height, image.width, image.height, image.unitsPerPixel, framing.zoom].every(value => Number.isFinite(value) && value > 0) ||
      ![framing.panX, framing.panY, yawDegrees, pitchDegrees].every(Number.isFinite)) throw new TypeError('Shape cloud camera inputs must be finite and have positive extents.');
  const fit = Math.min(width / image.width, height / image.height) * .94 * framing.zoom;
  const distanceUnits = SHAPE_CLOUD_FOCAL_PIXELS * image.unitsPerPixel / fit;
  const pitch = pitchDegrees * Math.PI / 180, yaw = yawDegrees * Math.PI / 180;
  const cx = Math.cos(pitch), sx = Math.sin(pitch), cy = Math.cos(yaw), sy = Math.sin(yaw);
  // Camera eye axes are x-right/y-down. Rx(180°) faces a physical x-right/y-up image.
  // Pre-multiply screen-axis yaw/pitch so dragging remains consistent across the Earth view.
  const rotation: WorldRotation = [cy, 0, -sy, sx * sy, -cx, sx * cy, -cx * sy, -sx, -cx * cy];
  const world = worldCameraFromCenteredPresentation({ rotation, distanceUnits }, {
    ...frame, presentationToReference: worldRotationFromQuaternion(frame.localToReferenceXyzw), bodyRadiusM: image.width * image.unitsPerPixel * frame.metersPerUnit / 2,
  }, { focalPixels: SHAPE_CLOUD_FOCAL_PIXELS, principalOffsetPixels: [0, 0] });
  return { world, viewport: { widthPixels: width, heightPixels: height, focalPixels: SHAPE_CLOUD_FOCAL_PIXELS,
    principalOffsetPixels: [framing.panX, framing.panY] } };
}
