import { systemHostId } from './navigation/system-address.mts';
import { orbitRoot } from './orbit-root.mts';
import type { PreparedWorldContext } from '@cssearth/objects';

/** What a system's members are read from: the bodies a plan holds, each naming the object it is inside. This module reads
 * no prepared presentation file, so the preparation step (site/build/prepare/prepare-world-presentation.mts) can run it
 * before that file exists. */
export type PlanetarySystemPlan = Pick<PreparedWorldContext, 'focus' | 'bodies'>;
export interface PlanetarySystemMembers { readonly id: string; readonly memberIds: readonly string[] }

/** Each body's host in the object tree: the host of the system the body, with any system of its own, is inside (`inside`
 * in its world row, packages/objects/src/prepared-data/world-context.ts). A moon's is its planet, a planet's its star, a
 * bound companion's the star it is bound to. A body inside no system has none. */
export function planetarySystemParents(plan: PlanetarySystemPlan): ReadonlyMap<string, string> {
  return new Map(plan.bodies.flatMap(body => {
    const host = body.inside === undefined ? null : systemHostId(body.inside);
    return host === null || host === body.id ? [] : [[body.id, host] as const];
  }));
}

/** Every candidate system host with the prepared bodies inside its system at any depth, in plan order. Candidates are the
 * focus and every body with a system view that is inside no other body's system: a planet's moons are not a planetary
 * system, and neither is a star inside another's (Epsilon Indi Ba, with Bb around it, is in Epsilon Indi A's system).
 * Whether a candidate is a star is the registry's to say (site/object-systems.mts). Each chain is walked once; a cyclic
 * chain anywhere in the plan is rejected. */
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
