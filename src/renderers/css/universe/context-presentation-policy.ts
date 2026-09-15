import type { PreparedWorldContext } from './prepared-world-context.js';
import type { OrbitLineFade } from '../navigation/types.js';
import { orbitLineOpacity } from '../navigation/perspective-dolly.js';

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

/** A planet and its satellites share emphasis, including when a moon is selected. */
export function createContextSelectionOpacity(plan: PreparedWorldContext) {
  const parents = new Map(plan.bodies.map(body => [body.id, body.orbit?.centerBodyId]));
  for (const [id, center] of Object.entries(plan.orbitCenters ?? {})) parents.set(id, center.centerBodyId);
  const systems = new Map<string, string>();
  for (const body of [plan.focus, ...plan.bodies]) {
    let system = body.id;
    const visited = new Set<string>();
    while (!visited.has(system)) {
      visited.add(system);
      const parent = parents.get(system);
      if (!parent || parent === plan.focus.id) break;
      system = parent;
    }
    systems.set(body.id, system);
  }
  return (bodyId: string, emphasizedId: string | null, hovered = false): number => {
    if (hovered || emphasizedId === null || emphasizedId === plan.focus.id || bodyId === emphasizedId) return 1;
    const selectedSystem = systems.get(emphasizedId);
    return selectedSystem !== undefined && systems.get(bodyId) === selectedSystem ? 1 : UNRELATED_OPACITY;
  };
}
