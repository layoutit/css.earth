import { orbitRoot } from '../src/platform/orbit-root.mts';
import type { PreparedWorldContext } from '@cssearth/renderer/prepared-data/world-context.ts';

/** The orbit graph a planetary system is read from. This module reads no prepared presentation file, so the preparation
 * step (site/build/prepare/prepare-world-presentation.mts) can run it before that file exists. */
export type PlanetarySystemPlan = Pick<PreparedWorldContext, 'focus' | 'bodies' | 'orbitCenters'>;
export interface PlanetarySystemMembers { readonly id: string; readonly memberIds: readonly string[] }

/** Each body's parent: its orbit centre, a named centre's own centre, or, for a star measured to be bound to another with no
 * measured orbit, its host, so the pair is one system. */
export function planetarySystemParents(plan: PlanetarySystemPlan): ReadonlyMap<string, string> {
  return new Map<string, string>([
    ...Object.entries(plan.orbitCenters ?? {}).map(([id, center]) => [id, center.centerBodyId] as const),
    ...plan.bodies.flatMap(body => body.orbit ? [[body.id, body.orbit.centerBodyId] as const]
      : body.boundTo ? [[body.id, body.boundTo.hostId] as const] : []),
  ]);
}

/** Every candidate system host with the prepared bodies whose orbit chain leads back to it, in plan order. Candidates are the
 * focus and every body with a system view that neither orbits nor is bound to another: a planet's moons are not a planetary
 * system, and neither is a star that itself orbits or is bound to another (Epsilon Indi Ba, with Bb around it, belongs to
 * Epsilon Indi A's system). Whether a candidate is a star is the registry's to say (site/object-systems.mts). Each chain is
 * walked once; a cyclic chain anywhere in the plan is rejected. */
export function planetarySystemMembers(plan: PlanetarySystemPlan): readonly PlanetarySystemMembers[] {
  const parents = planetarySystemParents(plan);
  const hosts = [plan.focus, ...plan.bodies.filter(body => body.systemView && !parents.has(body.id))];
  const members = new Map(hosts.map(host => [host.id, [] as string[]]));
  for (const body of plan.bodies) {
    const root = orbitRoot(body.id, parents);
    if (root !== body.id) members.get(root)?.push(body.id);
  }
  return hosts.map(host => ({ id: host.id, memberIds: members.get(host.id)! }));
}
