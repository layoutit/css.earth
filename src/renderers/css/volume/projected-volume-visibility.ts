import type { DensityVolumeFrame } from '@cssearth/objects';
import type { WorldCameraPose, WorldCameraViewport } from '../navigation/world-camera.js';

/** Projected-radius thresholds for prepared content that stands for a whole volume. */
export interface PreparedPointVisibility {
  readonly hiddenBelowRadiusPixels: number;
  readonly fullAboveRadiusPixels: number;
}

export const DEFAULT_POINT_VISIBILITY: PreparedPointVisibility = Object.freeze({ hiddenBelowRadiusPixels: 2, fullAboveRadiusPixels: 24 });

/** Radius about the frame origin that holds every corner of the prepared bounds. */
export function volumeFramingRadiusUnits(frame: DensityVolumeFrame): number {
  const { min, max } = frame.boundsUnits;
  return Math.hypot(...min.map((value, axis) => Math.max(Math.abs(value), Math.abs(max[axis]!))));
}

/** Opacity from a framing radius projected at the camera: none below the lower threshold, full above the upper. */
export function projectedVolumeOpacity(world: WorldCameraPose, viewport: WorldCameraViewport, frame: DensityVolumeFrame,
  framingRadiusUnits: number, visibility: PreparedPointVisibility = DEFAULT_POINT_VISIBILITY): number {
  const radiusPixels = projectedVolumeRadiusPixels(world, viewport, frame, framingRadiusUnits);
  const t = Math.max(0, Math.min(1, (radiusPixels - visibility.hiddenBelowRadiusPixels) /
    (visibility.fullAboveRadiusPixels - visibility.hiddenBelowRadiusPixels)));
  return t * t * (3 - 2 * t);
}

export function projectedVolumeRadiusPixels(world: WorldCameraPose, viewport: WorldCameraViewport, frame: DensityVolumeFrame,
  framingRadiusUnits: number): number {
  const distanceUnits = Math.hypot(...world.pose.positionM.map((value, axis) => value - frame.originM[axis]!)) / frame.metersPerUnit;
  return viewport.focalPixels * framingRadiusUnits / Math.max(Number.MIN_VALUE, distanceUnits);
}
