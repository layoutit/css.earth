import { worldCameraViewport, type WorldCameraViewport } from '../navigation/world-camera.js';
import type { WorldCameraPose } from '../navigation/world-camera.js';

/** The selected bank package: where it is and the radius its page frames. */
export interface SelectedBank { readonly positionM: readonly [number, number, number]; readonly framingRadiusM: number; }
/** Presentation only: normal focus arrival is about 6.1 authored radii. */
const HIDDEN_WITHIN_RADII = 8;
const RESTORED_BY_RADII = 32;

/** Fade surrounding detailed banks, without changing the observer or the Sun-distance sky policy. */
export function detailedFocusContextOpacity(world: WorldCameraPose,
  focus: SelectedBank | null): number {
  if (!focus) return 1;
  const radii = Math.hypot(...world.pose.positionM.map((value, axis) => value - focus.positionM[axis])) / focus.framingRadiusM;
  const progress = Math.max(0, Math.min(1, (radii - HIDDEN_WITHIN_RADII) / (RESTORED_BY_RADII - HIDDEN_WITHIN_RADII)));
  return progress * progress * (3 - 2 * progress);
}

/** Distant clouds stay out of body close-ups. Fade between a body occupying
 * 1/16 and 1/4 of the shorter viewport dimension, independent of device size. */
export function selectedBodyContextOpacity(world: WorldCameraPose, viewport: WorldCameraViewport,
  body: { positionM: readonly number[]; radiusM: number }): number {
  const extent = Math.min(viewport.widthPixels ?? Infinity, viewport.heightPixels ?? Infinity);
  if (!(extent > 0 && Number.isFinite(extent))) return 1;
  const distance = Math.hypot(...world.pose.positionM.map((value, axis) => value - body.positionM[axis]!));
  if (distance <= body.radiusM) return 0;
  const diameter = 2 * worldCameraViewport(world, viewport).focalPixels * body.radiusM /
    Math.sqrt(distance * distance - body.radiusM * body.radiusM);
  const progress = Math.max(0, Math.min(1, (diameter / extent - 1 / 16) / (1 / 4 - 1 / 16)));
  return 1 - progress * progress * (3 - 2 * progress);
}
