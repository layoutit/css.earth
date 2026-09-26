import { APPLICATION_WORLD_CONTEXT as context } from './world-context-plan.mts';

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
  for (const body of plan.bodies) {
    if (body.classification !== 'satellite' || !body.orbit) continue;
    const host = byId.get(body.orbit.centerBodyId);
    if (!host || host.classification === 'star' || host.classification === 'black-hole') continue;
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

const systems = satelliteSystems();
const byHost = new Map(systems.map(system => [system.hostId, system]));
const byMember = new Map(systems.flatMap(system => system.memberIds.map(id => [id, system] as const)));
export const allSatelliteSystems = () => systems;
export const satelliteSystemByHost = (id: string) => byHost.get(id) ?? null;
export const satelliteSystemOfMember = (id: string) => byMember.get(id) ?? null;
