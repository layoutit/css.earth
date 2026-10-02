import type { OrbitLineFade } from '../navigation/types.js';
import { orbitLineOpacity } from '../navigation/perspective-dolly.js';

const CLOSE_ORBIT_OPACITY = .3;
const UNRELATED_ORBIT_OPACITY = .25;

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

/** An orbit belongs to the family it circles, not the body travelling on it. While a planet, one of its moons or its
 * moons view is the subject, a path around anything outside that family is dim context: the other planets' always, and
 * the host's own path about its star when the subject is not the host itself. `host` is the family's host, absent when
 * the subject is a star or nothing. The dimming relaxes from half to twice the host's distance from its star, where the
 * subject is the parent system again; a selected moons view keeps it. 1/64 steps avoid rewriting opacity for tiny camera
 * changes. */
export function outsideFamilyOrbitOpacity<Host extends { readonly positionM: readonly number[]; readonly orbit?: { readonly centerPositionM: readonly number[] } | null }>(
  host: Host | undefined, cameraDistanceM: (host: Host) => number, selectedSystem: boolean): number {
  if (!host?.orbit) return 1;
  const radiusM = Math.hypot(...host.positionM.map((value, axis) => value - host.orbit!.centerPositionM[axis]!));
  const t = selectedSystem || !(radiusM > 0) ? 0 : Math.max(0, Math.min(1, Math.log2(cameraDistanceM(host) / (.5 * radiusM)) / 2));
  return 1 - (1 - UNRELATED_ORBIT_OPACITY) * Math.round((1 - t * t * (3 - 2 * t)) * 64) / 64;
}
