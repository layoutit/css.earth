import { orbitRoot } from '../src/platform/orbit-root.mts';
import type { PositionM } from '@cssearth/engine';
import type { PreparedWorldContext } from '../src/renderers/css/prepared-data/world-context.js';
import type { ObjectEntry } from './object-schema.mts';
import { OVERVIEW_SELECTION_POLICY as policy } from './runtime-policy.mts';
import { SYSTEM_FRAMING_RADII, systemFramingRadii } from './system-framing.mts';
import { APPLICATION_WORLD_CONTEXT as context } from './world-context-plan.mts';

/** A star and every prepared body whose orbit chain leads back to it. The Sun's is the Solar System. */
export interface PlanetarySystem {
  readonly id: string; readonly name: string; readonly route: string; readonly originM: PositionM;
  readonly memberIds: readonly string[];
  /** The prepared framing radius: the farthest framed orbit plus its body. */
  readonly radiusM: number;
  /** Leaving this far from the star opens the system overview: the Sun's 100 AU, scaled by the system's prepared size. */
  readonly exitDistanceM: number;
}
/** The Solar System's star: the prepared world context's focus. */
export const SOLAR_SYSTEM_ID = context.focus.id;
type Plan = Pick<PreparedWorldContext, 'focus' | 'bodies' | 'orbitCenters'>;

export function planetarySystems(objects: readonly (Pick<ObjectEntry, 'id' | 'name' | 'systemName' | 'classification' | 'route'> & { readonly worldFrame?: { readonly originM: PositionM } | null })[],
  plan: Plan = context, radii: ReadonlyMap<string, number> = plan === context ? SYSTEM_FRAMING_RADII : systemFramingRadii(plan)): readonly PlanetarySystem[] {
  const registry = new Map(objects.map(object => [object.id, object]));
  // A star measured to be bound to another with no measured orbit belongs to its host's system: the pair is one system.
  const parents = new Map<string, string>([
    ...Object.entries(plan.orbitCenters ?? {}).map(([id, center]) => [id, center.centerBodyId] as const),
    ...plan.bodies.flatMap(body => body.orbit ? [[body.id, body.orbit.centerBodyId] as const]
      : body.boundTo ? [[body.id, body.boundTo.hostId] as const] : []),
  ]);
  // Hosts are the focus and every star the prepared context frames with orbiting members; a planet's moons are not a
  // planetary system, and neither is a star that itself orbits or is bound to another (Epsilon Indi Ba, with Bb around it,
  // belongs to Epsilon Indi A's system). A registry without the star (a partial fixture) has no system for it.
  const hosts = [plan.focus, ...plan.bodies.filter(body => body.systemView && !parents.has(body.id))].filter(body => ['star', 'black-hole'].includes(registry.get(body.id)?.classification ?? ''));
  const solarRadiusM = radii.get(plan.focus.id);
  if (!solarRadiusM) throw new TypeError('The Solar System requires its prepared framing radius.');
  return Object.freeze(hosts.map(host => {
    const star = registry.get(host.id), radiusM = radii.get(host.id);
    if (!star || !radiusM) throw new TypeError(`Planetary system ${host.id} requires a registered star and its prepared framing.`);
    const memberIds = plan.bodies.filter(body => body.id !== host.id && orbitRoot(body.id, parents) === host.id).map(body => body.id);
    for (const id of memberIds) {
      const member = registry.get(id);
      if (member && member.systemName !== star.systemName) throw new TypeError(`${id} orbits ${star.name} but names its system ${member.systemName}, not ${star.systemName}.`);
    }
    return Object.freeze({ id: host.id, name: star.systemName, route: star.route, originM: star.worldFrame?.originM ?? host.positionM,
      memberIds: Object.freeze(memberIds), radiusM, exitDistanceM: policy.exitSunDistanceM * radiusM / solarRadiusM });
  }));
}

const cache = new WeakMap<object, readonly PlanetarySystem[]>();
const systemsOf = (objects: Parameters<typeof planetarySystems>[0]) => {
  let systems = cache.get(objects);
  if (!systems) cache.set(objects, systems = planetarySystems(objects));
  return systems;
};
/** The system an object hosts or belongs to; null for a star or body outside every system. */
export function systemOfObject(objects: Parameters<typeof planetarySystems>[0], objectId: string): PlanetarySystem | null {
  return systemsOf(objects).find(system => system.id === objectId || system.memberIds.includes(objectId)) ?? null;
}
export function systemById(objects: Parameters<typeof planetarySystems>[0], systemId: string): PlanetarySystem | null {
  return systemsOf(objects).find(system => system.id === systemId) ?? null;
}
export const allPlanetarySystems = systemsOf;
/** The objects systems are built from: the world's bodies (`world-objects.mts`) or the registry. */
export type SystemObjects = Parameters<typeof planetarySystems>[0];
