import type { DensityVolumeFrame } from '@cssearth/objects';
import type { WorldCameraPose, WorldCameraViewport } from '../navigation/world-camera.js';
import { projectVolumeSphere } from '../volume/projected-volume-visibility.js';

/** The least a caption hangs below its galaxy's centre: the radius of every other context marker. */
const MIN_CAPTION_DROP_PX = 8;

/**
 * Where a galaxy's caption hangs: under the sphere its drawing fills (`drawnRadiusUnits`), seen along the tangent cone
 * so the caption clears the drawing from any side. Null inside its published stellar extent (`extentRadiusUnits`), where
 * the camera is within the galaxy and no caption names it from outside, and behind the camera.
 */
export function projectGalaxyCaptionAnchor(world: WorldCameraPose, viewport: WorldCameraViewport, frame: DensityVolumeFrame,
  drawnRadiusUnits: number, extentRadiusUnits: number): { readonly x: number; readonly centreY: number; readonly y: number } | null {
  if (!(drawnRadiusUnits > 0) || !(extentRadiusUnits > 0)) throw new TypeError(`A galaxy caption needs positive radii, got drawn ${drawnRadiusUnits} and extent ${extentRadiusUnits} units.`);
  if (projectVolumeSphere(world, viewport, frame, extentRadiusUnits).inside) return null;
  const { x, y, depth, distance } = projectVolumeSphere(world, viewport, frame, drawnRadiusUnits);
  if (!(depth > 0)) return null;
  const drop = distance > drawnRadiusUnits
    ? viewport.focalPixels * drawnRadiusUnits / (depth > drawnRadiusUnits ? depth : Math.sqrt(distance * distance - drawnRadiusUnits * drawnRadiusUnits))
    : MIN_CAPTION_DROP_PX;
  return { x, centreY: y, y: y + Math.max(MIN_CAPTION_DROP_PX, drop) };
}
