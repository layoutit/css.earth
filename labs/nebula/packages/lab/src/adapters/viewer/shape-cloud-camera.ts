/** Compatibility API with an explicit cssEarth camera binding. */
import { shapeCloudCamera as createCamera, shapeCloudOrthographicCamera as createOrthographicCamera } from '@cssearth/volume-viewer/camera/shape-cloud';
import type { DensityVolumeFrame } from '@cssearth/bake/volume';
import type { ViewFraming as ShapeCloudFraming } from '@cssearth/volume-viewer/camera/framing';
import { shapeCloudCameraBackend } from './shape-cloud-renderer';
export type { ViewFraming as ShapeCloudFraming } from '@cssearth/volume-viewer/camera/framing';
export { SHAPE_CLOUD_FOCAL_PIXELS } from '@cssearth/volume-viewer/camera/shape-cloud';

export function shapeCloudCamera(frame: DensityVolumeFrame, image: { width: number; height: number; unitsPerPixel: number },
  viewport: { width: number; height: number }, framing: ShapeCloudFraming, yawDegrees: number, pitchDegrees: number) {
  return createCamera(shapeCloudCameraBackend, frame, image, viewport, framing, yawDegrees, pitchDegrees);
}
export function shapeCloudOrthographicCamera(...args: Parameters<typeof shapeCloudCamera>) {
  return createOrthographicCamera(shapeCloudCameraBackend, ...args);
}
