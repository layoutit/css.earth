import type { OrbitLineFade } from '../navigation/types.js';
import { orbitLineOpacity } from '../navigation/perspective-dolly.js';

const CLOSE_ORBIT_OPACITY = .3;

/** At close range retain the nearby orbit, then soften its distant continuation.
 * At system scale the full orbit lies inside the unfaded range. */
export function selectedOrbitDepthFade(cameraDistanceM: number) {
  return { start: cameraDistanceM * 4, end: cameraDistanceM * 16 };
}

/** Close detail softens context lines without removing their projected paths. */
export function contextOrbitOpacity(fade: OrbitLineFade, discHeightShare: number): number {
  return CLOSE_ORBIT_OPACITY + (1 - CLOSE_ORBIT_OPACITY) * orbitLineOpacity(fade, discHeightShare);
}

/** The focused body's own orbit has no close-up floor. Up close it is a line through the body's centre that says nothing,
 * as a map shows no orbit at all; it fades out with the body's growth and returns as the camera pulls back to the system. */
export function focusOwnOrbitOpacity(fade: OrbitLineFade, discHeightShare: number): number {
  return orbitLineOpacity(fade, discHeightShare);
}
