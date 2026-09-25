import type { DensityVolumeFrame } from '@cssearth/bake/volume';
import type { ViewFraming } from './framing.ts';
import type { SceneImage, SceneViewport } from '../scene/backend.ts';

export const SHAPE_CLOUD_FOCAL_PIXELS = 1e7;
export interface ShapeCloudCameraBackend<Publication> {
  readonly cssPixelsPerUnit: number;
  publication(frame: DensityVolumeFrame, image: SceneImage, viewport: SceneViewport, framing: ViewFraming,
    rotation: readonly number[], distanceUnits: number, focalPixels: number): Publication;
  rotation(publication: Publication, frame: DensityVolumeFrame): readonly number[];
  rotationCss(rotation: readonly number[]): string;
}

/** True orthographic CSS3D avoids Chromium's large-depth loss of tilted slices. */
export function shapeCloudOrthographicCamera<Publication>(backend: ShapeCloudCameraBackend<Publication>,
  frame: DensityVolumeFrame, image: SceneImage, viewport: SceneViewport, framing: ViewFraming,
  yawDegrees: number, pitchDegrees: number) {
  const publication = shapeCloudCamera(backend, frame, image, viewport, framing, yawDegrees, pitchDegrees);
  const rotation = backend.rotation(publication, frame);
  const scale = Math.min(viewport.width / image.width, viewport.height / image.height) * .94 * framing.zoom / (backend.cssPixelsPerUnit * image.unitsPerPixel);
  const transform = `translate3d(${framing.panX}px,${framing.panY}px,0px) scale3d(${scale},${scale},${scale}) ${backend.rotationCss(rotation)}`;
  return { publication, rotation, scale, transform };
}

/** Physical orientation transport; the host supplies its canonical world-camera representation. */
export function shapeCloudCamera<Publication>(backend: ShapeCloudCameraBackend<Publication>, frame: DensityVolumeFrame,
  image: SceneImage, viewport: SceneViewport, framing: ViewFraming, yawDegrees: number, pitchDegrees: number): Publication {
  const { width, height } = viewport;
  if (![width, height, image.width, image.height, image.unitsPerPixel, framing.zoom].every(value => Number.isFinite(value) && value > 0) ||
      ![framing.panX, framing.panY, yawDegrees, pitchDegrees].every(Number.isFinite)) throw new TypeError('Shape cloud camera inputs must be finite and have positive extents.');
  const fit = Math.min(width / image.width, height / image.height) * .94 * framing.zoom;
  const distanceUnits = SHAPE_CLOUD_FOCAL_PIXELS * image.unitsPerPixel / fit;
  const pitch = pitchDegrees * Math.PI / 180, yaw = yawDegrees * Math.PI / 180;
  const cx = Math.cos(pitch), sx = Math.sin(pitch), cy = Math.cos(yaw), sy = Math.sin(yaw);
  // Eye axes are x-right/y-down; pre-multiply screen yaw/pitch over Rx(180°).
  const rotation = [cy, 0, -sy, sx * sy, -cx, sx * cy, -cx * sy, -sx, -cx * cy];
  return backend.publication(frame, image, viewport, framing, rotation, distanceUnits, SHAPE_CLOUD_FOCAL_PIXELS);
}
