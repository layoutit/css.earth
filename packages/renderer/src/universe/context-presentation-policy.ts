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

interface FamilyPoint {
  readonly id: string; readonly positionM: readonly number[];
  readonly orbit?: { readonly centerBodyId: string; readonly lod?: { readonly bounds: { readonly radiusM: number } } } | null;
}

/** An orbit belongs to the family it circles, not the body travelling on it. While a planet, one of its moons or its
 * system is the subject, a path around anything outside that family, the host's own stellar orbit included, is dim
 * context. The family is the subject's outermost host below the system's star with everything that circles inside it.
 * The emphasis relaxes from half to twice the host's stellar-orbit radius, where the subject is the parent system
 * again; a selected system keeps it. 1/64 steps avoid rewriting opacity for tiny camera changes.
 * Returns the opacity of a path by the body it circles. */
export function orbitFamilyEmphasis<Point extends FamilyPoint>(emphasizedId: string | null, pointOf: (id: string) => Point | undefined,
  isSystemStar: (id: string) => boolean, cameraDistanceM: (point: Point) => number, selectedSystem: boolean): (centerBodyId: string) => number {
  const familyOf = (id: string) => {
    for (let center = pointOf(id)?.orbit?.centerBodyId, hops = 0; center !== undefined && !isSystemStar(center) && hops < 8;
      center = pointOf(id)?.orbit?.centerBodyId, hops++) id = center;
    return id;
  };
  const host = emphasizedId === null || isSystemStar(emphasizedId) ? undefined : pointOf(familyOf(emphasizedId));
  if (!host?.orbit) return () => 1;
  const star = pointOf(host.orbit.centerBodyId);
  const radiusM = host.orbit.lod?.bounds.radiusM ?? Math.hypot(...host.positionM.map((value, axis) => value - (star?.positionM[axis] ?? 0)));
  const t = selectedSystem || !(radiusM > 0) ? 0 : Math.max(0, Math.min(1, Math.log2(cameraDistanceM(host) / (.5 * radiusM)) / 2));
  const unrelated = 1 - (1 - UNRELATED_ORBIT_OPACITY) * Math.round((1 - t * t * (3 - 2 * t)) * 64) / 64;
  return centerBodyId => unrelated === 1 || centerBodyId === host.id || familyOf(centerBodyId) === host.id ? 1 : unrelated;
}
