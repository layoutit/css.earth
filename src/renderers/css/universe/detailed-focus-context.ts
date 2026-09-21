import type { PreparedNavigationFocus } from '../navigation/prepared-focus.js';
import type { WorldCameraPose } from '../navigation/world-camera.js';

/** Presentation only: normal focus arrival is about 6.1 authored radii. */
const HIDDEN_WITHIN_RADII = 8;
const RESTORED_BY_RADII = 32;

/** Fade surrounding detailed banks, without changing the observer or the Sun-distance sky policy. */
export function detailedFocusContextOpacity(world: WorldCameraPose,
  focus: Pick<PreparedNavigationFocus, 'positionM' | 'framingRadiusM'> | null): number {
  if (!focus) return 1;
  const radii = Math.hypot(...world.pose.positionM.map((value, axis) => value - focus.positionM[axis])) / focus.framingRadiusM;
  const progress = Math.max(0, Math.min(1, (radii - HIDDEN_WITHIN_RADII) / (RESTORED_BY_RADII - HIDDEN_WITHIN_RADII)));
  return progress * progress * (3 - 2 * progress);
}
