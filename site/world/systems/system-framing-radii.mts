import type { PreparedWorldContext } from '@cssearth/objects';
import { SYSTEM_FRAMING_MIN_MOON_RADIUS_SHARE } from '../../browser/runtime-policy.mts';

/** Camera framing consumes the prepared orbit bounds, never orbit vertices. */
export function systemFramingRadii(plan: Pick<PreparedWorldContext, 'focus' | 'bodies'>) {
  const parents = new Map([...(plan.focus?.systemView ? [plan.focus] : []), ...plan.bodies].map(body => [body.id, body]));
  const largestMoons = new Map<string, number>();
  for (const moon of plan.bodies) {
    const parentId = moon.orbit?.centerBodyId;
    if (!parentId || !parents.has(parentId) || !moon.orbit?.bounds) continue;
    largestMoons.set(parentId, Math.max(largestMoons.get(parentId) ?? 0, moon.radiusM));
  }
  const radii = new Map<string, number>();
  for (const moon of plan.bodies) {
    const parent = parents.get(moon.orbit?.centerBodyId ?? ""), bounds = moon.orbit?.bounds;
    if (!parent || !bounds) continue;
    if (parent.systemView ? !parent.systemView.memberIds.includes(moon.id)
      : moon.radiusM < (largestMoons.get(parent.id) ?? 0) * SYSTEM_FRAMING_MIN_MOON_RADIUS_SHARE) continue;
    const radius = Math.hypot(...bounds.centerM.map((value, axis) => value - parent.positionM[axis]))
      + bounds.radiusM + moon.radiusM;
    radii.set(parent.id, Math.max(radii.get(parent.id) ?? parent.radiusM, radius));
  }
  // A star nothing orbits, with stars bound to it, is framed out to those stars (its system view's members).
  for (const star of plan.bodies) {
    const host = star.boundTo ? parents.get(star.boundTo.hostId) : undefined;
    if (!host?.systemView?.memberIds.includes(star.id)) continue;
    const radius = Math.hypot(...star.positionM.map((value, axis) => value - host.positionM[axis]!)) + star.radiusM;
    radii.set(host.id, Math.max(radii.get(host.id) ?? host.radiusM, radius));
  }
  return radii;
}
