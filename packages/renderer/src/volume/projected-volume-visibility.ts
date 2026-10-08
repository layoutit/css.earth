import { DEFAULT_POINT_VISIBILITY, type PreparedPointVisibility, type DensityVolumeFrame } from '@cssearth/objects';
import { type WorldCameraPose, presentPhysicalPoseInVolume, eyeDistanceM, cssCameraAxesFromOrientation } from '@cssearth/engine';

import type { WorldCameraViewport } from '../navigation/camera/world-camera.js';
import { dot3 as dot } from '@cssearth/core';

type Vector = readonly [number, number, number];

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

/** How much of a volume's billboard draws by where the camera stands: nothing inside the volume's framing sphere, all of it from
 * a quarter of that radius farther out, evenly in the logarithm between. A billboard is the volume seen from outside; from inside its sphere the
 * impostor has no view to take (M33's photograph drew a hundred pixels wide beside a star 5,600 light-years away inside it,
 * 2026-10-01), and what the volume holds there (a galaxy's catalogue dots) stands for it. */
export function outsideVolumeOpacity(world: WorldCameraPose, frame: DensityVolumeFrame, framingRadiusUnits: number): number {
  const distanceUnits = eyeDistanceM(world.pose, frame.originM) / frame.metersPerUnit;
  return Math.max(0, Math.min(1, Math.log(distanceUnits / framingRadiusUnits) / Math.log(1.25)));
}

/** How far out a picture is gone on a flight into it, in its framing radii: it fills the view there. The flights measured
 * come an eighth nearer on each frame at that point (M33's quarter of a radius took two frames), so three frames or more
 * are left before the page's body, where its scene keeps its last frame. */
const ENTERED_AT_RADII = 1.5;

/** Whether a volume's framing sphere holds a place, in reference metres. */
export function volumeHolds(frame: DensityVolumeFrame, framingRadiusUnits: number, positionM: readonly number[]): boolean {
  const reachM = framingRadiusUnits * frame.metersPerUnit;
  return Math.hypot(positionM[0]! - frame.originM[0], positionM[1]! - frame.originM[1], positionM[2]! - frame.originM[2]) <= reachM;
}

/** How much of a page's own picture draws on a flight from that page to a body inside the picture: all of it until it
 * comes to fill the view, none from there in. The page stays the selected one until the flight's hand-over, and its scene
 * keeps its last frame once the camera is inside its body (object-orbit.ts `adoptWorldCamera`): flying from M33 to its
 * star VHK 45, the galaxy's photograph as it last drew filled the screen from 0.4 s to the hand-over at 5.1 s, behind a
 * camera that ended 9 au from the star, and went in one frame; so did the picture of each of the 24 galaxies that hold a
 * star (2026-10-07). The body's own page draws none of it in its close-up. */
export function enteredVolumeOpacity(world: WorldCameraPose, frame: DensityVolumeFrame, framingRadiusUnits: number): number {
  return outsideVolumeOpacity(world, frame, ENTERED_AT_RADII * framingRadiusUnits);
}

export function projectedVolumeRadiusPixels(world: WorldCameraPose, viewport: WorldCameraViewport, frame: DensityVolumeFrame,
  framingRadiusUnits: number): number {
  const distanceUnits = eyeDistanceM(world.pose, frame.originM) / frame.metersPerUnit;
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
