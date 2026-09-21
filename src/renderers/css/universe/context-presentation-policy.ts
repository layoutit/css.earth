import type { PreparedWorldContext } from './prepared-world-context.js';
import type { OrbitLineFade } from '../navigation/types.js';
import { orbitLineOpacity } from '../navigation/perspective-dolly.js';
import type { PositionM } from '@cssearth/engine';

const CLOSE_ORBIT_OPACITY = .3;
const UNRELATED_OPACITY = .25;

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

/** A planet and its satellites share emphasis, including when a moon is selected. */
export function createContextSelectionPolicy(plan: PreparedWorldContext) {
  const parents = new Map(plan.bodies.map(body => [body.id, body.orbit?.centerBodyId]));
  for (const [id, center] of Object.entries(plan.orbitCenters ?? {})) parents.set(id, center.centerBodyId);
  // A planetary system's star orbits nothing: the Sun, or a placed star that bodies orbit.
  const systemStars = new Set([plan.focus.id, ...[...parents.values()].filter((id): id is string => id !== undefined && !parents.get(id))]);
  const systems = new Map<string, string>();
  for (const body of [plan.focus, ...plan.bodies]) {
    let system = body.id;
    const visited = new Set<string>();
    while (!visited.has(system)) {
      visited.add(system);
      const parent = parents.get(system);
      if (!parent || systemStars.has(parent)) break;
      system = parent;
    }
    systems.set(body.id, system);
  }
  const scales = new Map(plan.bodies.filter(body => systems.get(body.id) === body.id).map(body => [body.id, {
    position: body.positionM,
    radius: body.orbit?.lod?.bounds.radiusM ?? Math.hypot(...body.positionM.map((value, axis) => value - plan.focus.positionM[axis])),
  }]));
  return {
    /** Relax emphasis from half to twice the primary body's solar-orbit radius.
     * Moons share their planet's scale. Distance makes the fade independent of
     * viewing angle; 1/64 steps avoid rewriting opacity for tiny camera changes. */
    strengthAt(emphasizedId: string | null, cameraPositionM: PositionM): number {
      if (emphasizedId === null || systemStars.has(emphasizedId)) return 0;
      const scale = scales.get(systems.get(emphasizedId) ?? emphasizedId);
      if (!scale || !(scale.radius > 0)) return 1;
      const distance = Math.hypot(...cameraPositionM.map((value, axis) => value - scale.position[axis]));
      const t = Math.max(0, Math.min(1, Math.log2(distance / (.5 * scale.radius)) / 2));
      return Math.round((1 - t * t * (3 - 2 * t)) * 64) / 64;
    },
    opacity(bodyId: string, emphasizedId: string | null, hovered = false, strength = 1): number {
      if (hovered || emphasizedId === null || systemStars.has(emphasizedId) || bodyId === emphasizedId) return 1;
      const selectedSystem = systems.get(emphasizedId);
      return selectedSystem !== undefined && systems.get(bodyId) === selectedSystem ? 1 : 1 - (1 - UNRELATED_OPACITY) * strength;
    },
  };
}
