import { systemHostId } from './system-address.mts';
import { orbitRoot } from './orbit-root.mts';
import type { PreparedWorldContext } from '@cssearth/objects';

/** What a system's members are read from: the bodies a plan holds, each naming the object it is inside. This module reads
 * no prepared presentation file, so the preparation step (site/build/prepare/prepare-world-presentation.mts) can run it
 * before that file exists. */
export type PlanetarySystemPlan = Pick<PreparedWorldContext, 'focus' | 'bodies'>;
export interface PlanetarySystemMembers { readonly id: string; readonly memberIds: readonly string[] }

/** Each body's host in the object tree: the host of the system the body, with any system of its own, is inside (`inside`
 * in its world row, packages/objects/src/prepared-data/world/world-context.ts). A moon's is its planet, a planet's its star, a
 * bound companion's the star it is bound to. A body inside no system has none. */
export function planetarySystemParents(plan: PlanetarySystemPlan): ReadonlyMap<string, string> {
  return new Map(plan.bodies.flatMap(body => {
    const host = body.inside === undefined ? null : systemHostId(body.inside);
    return host === null || host === body.id ? [] : [[body.id, host] as const];
  }));
}

/** Every candidate system host with the prepared bodies inside its system at any depth, in plan order. Candidates are the
 * focus and every body with a system view, wherever it is in the tree: a star inside another's system hosts its own inside
 * it (Epsilon Indi Ba, with Bb around it, hosts Epsilon Indi B inside Epsilon Indi A's system), and its members are
 * members of both. Whether a candidate is a star is the registry's to say (site/object-systems.mts): a planet with moons
 * is a candidate too, and no planetary system. A cyclic chain anywhere in the plan is rejected. */
export function planetarySystemMembers(plan: PlanetarySystemPlan): readonly PlanetarySystemMembers[] {
  const parents = planetarySystemParents(plan);
  const hosts = [plan.focus, ...plan.bodies.filter(body => body.systemView)];
  const members = new Map(hosts.map(host => [host.id, [] as string[]]));
  for (const body of plan.bodies) {
    // The walk below ends: the chain of hosts has a root.
    orbitRoot(body.id, parents);
    for (let host = parents.get(body.id); host !== undefined; host = parents.get(host)) members.get(host)?.push(body.id);
  }
  return hosts.map(host => ({ id: host.id, memberIds: members.get(host.id)! }));
}
