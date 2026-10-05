import { systemHostId } from './model/system-address.mts';
import { APPLICATION_WORLD_CONTEXT as context, onWorldSystems } from './world-context-plan.mts';

/** A host and its prepared, navigable satellite children. Framing may select a smaller primary subset. */
export interface SatelliteSystem {
  readonly hostId: string;
  readonly hostName: string;
  readonly name: string;
  readonly memberIds: readonly string[];
  readonly framedIds: readonly string[];
}

export function satelliteSystems(plan: Pick<typeof context, 'focus' | 'bodies'> = context): readonly SatelliteSystem[] {
  const bodies = [plan.focus, ...plan.bodies];
  const byId = new Map(bodies.map(body => [body.id, body]));
  const children = new Map<string, typeof plan.bodies[number][]>();
  // A planet's or a small body's system holds the bodies inside it in the object tree (`inside` in each world row).
  for (const body of plan.bodies) {
    const host = body.inside === undefined ? undefined : byId.get(systemHostId(body.inside) ?? '');
    if (!host || host.id === body.id || host.classification === 'star' || host.classification === 'black-hole') continue;
    const members = children.get(host.id) ?? [];
    members.push(body);
    children.set(host.id, members);
  }
  return Object.freeze([...children].map(([hostId, members]) => {
    const host = byId.get(hostId)!;
    if (!host.systemView) throw new TypeError(`${hostId} has prepared satellites but no system view.`);
    const memberIds = members.map(member => member.id);
    for (const id of host.systemView.memberIds) {
      if (!memberIds.includes(id)) throw new TypeError(`${hostId} frames ${id}, which is not its prepared satellite.`);
    }
    return Object.freeze({ hostId, hostName: host.name,
      name: members.length === 1 ? `${host.name}–${members[0]!.name} system` : `${host.name} system`,
      memberIds: Object.freeze(memberIds), framedIds: Object.freeze([...host.systemView.memberIds]) });
  }));
}

/** A plan's satellite systems, by host and by member. */
export function satelliteSystemIndex(plan: Pick<typeof context, 'focus' | 'bodies'>) {
  const systems = satelliteSystems(plan);
  return Object.freeze({ systems, byHost: new Map(systems.map(system => [system.hostId, system])),
    byMember: new Map(systems.flatMap(system => system.memberIds.map(id => [id, system] as const))) });
}

// The application's index follows its plan: a system read later brings its hosts' families with it.
let index = satelliteSystemIndex(context);
onWorldSystems(plan => { index = satelliteSystemIndex(plan); });
export const allSatelliteSystems = () => index.systems;
export const satelliteSystemByHost = (id: string) => index.byHost.get(id) ?? null;
export const satelliteSystemOfMember = (id: string) => index.byMember.get(id) ?? null;
