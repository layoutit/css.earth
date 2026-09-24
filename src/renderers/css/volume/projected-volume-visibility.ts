import { presentPhysicalPoseInVolume } from '@cssearth/engine';
import type { DensityVolumeFrame } from '@cssearth/objects';
import type { WorldCameraPose, WorldCameraViewport } from '../navigation/world-camera.js';
import { cssCameraAxesFromOrientation } from '../navigation/world-camera-math.js';
import { dot3 as dot } from '../../../platform/vector3.mts';

type Vector = readonly [number, number, number];

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

/** A volume's bounding sphere through the physical camera: its camera axes, depth and screen centre, and
 * whether any of it can reach the viewport. */
export function projectVolumeSphere(world: WorldCameraPose, viewport: WorldCameraViewport, frame: DensityVolumeFrame, radiusUnits: number) {
  const local = presentPhysicalPoseInVolume(world.pose, frame), rotation = cssCameraAxesFromOrientation(local.orientationXyzw);
  const right: Vector = [rotation[0]!, rotation[3]!, rotation[6]!];
  const down: Vector = [rotation[1]!, rotation[4]!, rotation[7]!];
  const back: Vector = [rotation[2]!, rotation[5]!, rotation[8]!];
  const depth = dot(back, local.positionUnits), distance = Math.hypot(...local.positionUnits);
  const scale = viewport.focalPixels / Math.max(Number.MIN_VALUE, depth);
  const x = viewport.principalOffsetPixels[0] - dot(right, local.positionUnits) * scale;
  const y = viewport.principalOffsetPixels[1] - dot(down, local.positionUnits) * scale;
  // Whether the camera is inside is its true distance, not its depth along the view axis: a distant cloud beside
  // the camera has near-zero depth and must not pass for a near one.
  const inside = distance <= radiusUnits;
  // Outside, the sphere is visible when its angular radius reaches into the field of view (the viewport's half
  // diagonal), and, in front of the camera, when its projected footprint overlaps the viewport.
  const halfWidth = (viewport.widthPixels ?? Infinity) / 2, halfHeight = (viewport.heightPixels ?? Infinity) / 2;
  const fieldRadius = Math.atan(Math.hypot(halfWidth, halfHeight) / viewport.focalPixels);
  const offAxis = Math.acos(Math.max(-1, Math.min(1, depth / Math.max(Number.MIN_VALUE, distance))));
  const reachesField = offAxis - Math.asin(Math.min(1, radiusUnits / Math.max(Number.MIN_VALUE, distance))) < fieldRadius;
  const extent = viewport.focalPixels * radiusUnits / Math.max(Number.MIN_VALUE, depth - radiusUnits);
  const visible = inside || (reachesField && (depth <= radiusUnits ||
    (Math.abs(x) <= halfWidth + extent && Math.abs(y) <= halfHeight + extent)));
  return { local, right, down, back, depth, distance, x, y, inside, visible };
}
