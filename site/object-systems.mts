import type { PositionM } from '@cssearth/engine';
import type { PreparedWorldContext } from '@cssearth/renderer/prepared-data/world-context.ts';
import type { ObjectEntry } from './objects.mts';
import { planetarySystemMembers, type PlanetarySystemMembers } from './planetary-system-members.mts';
import { PREPARED_WORLD_PRESENTATION } from './prepared-world-presentation.mts';
import { OVERVIEW_SELECTION_POLICY as policy } from './runtime-policy.mts';
import { SYSTEM_FRAMING_RADII, systemFramingRadii } from './system-framing.mts';
import { APPLICATION_WORLD_CONTEXT as context } from './world-context-plan.mts';
import { systemFadeDistances } from '@cssearth/renderer/universe/world-context/context-scale.ts';

/** A star and every prepared body whose orbit chain leads back to it. The Sun's is the Solar System. */
export interface PlanetarySystem {
  readonly id: string; readonly name: string; readonly route: string; readonly originM: PositionM;
  readonly memberIds: readonly string[];
  /** The prepared framing radius: the farthest framed orbit plus its body. */
  readonly radiusM: number;
  /** Leaving this far from the star opens the system overview: the Sun's 100 AU, scaled by the system's prepared size, and
   * no farther than a quarter of the distance where its orbits are gone, where the overview gives way (overview-context.mts).
   * It then lasts at least two doublings of distance, wider than a mouse-wheel step at these scales, so zooming out
   * shows it rather than stepping over it. Only Sgr A* is held by this: its
   * S-star orbits are gone at 3.2 ly, so its overview opens at 0.8 ly, not at the scaled 3.6 ly. */
  readonly exitDistanceM: number;
}
/** The Solar System's star: the prepared world context's focus. */
export const SOLAR_SYSTEM_ID = context.focus.id;
type Plan = Pick<PreparedWorldContext, 'focus' | 'bodies' | 'orbitCenters' | 'system'> & Partial<Pick<PreparedWorldContext, 'deferred'>>;
/** How many times its opening distance a system overview lasts before its orbits are gone: two doublings. */
const SYSTEM_OVERVIEW_SPAN = 4;

export function planetarySystems(objects: readonly (Pick<ObjectEntry, 'id' | 'name' | 'systemName' | 'classification' | 'route'> & { readonly worldFrame?: { readonly originM: PositionM } | null })[],
  plan: Plan = context, radii: ReadonlyMap<string, number> = plan === context ? SYSTEM_FRAMING_RADII : systemFramingRadii(plan),
  // The application's members come prepared (site/build/prepare/prepare-world-presentation.mts); another plan's are read here.
  candidates: readonly PlanetarySystemMembers[] = plan === context ? PREPARED_WORLD_PRESENTATION.planetarySystems : planetarySystemMembers(plan)): readonly PlanetarySystem[] {
  const registry = new Map(objects.map(object => [object.id, object]));
  const points = new Map([plan.focus, ...plan.bodies].map(body => [body.id, body]));
  // A member whose system the page has not read is listed by the summary instead (site/world-context-plan.mts).
  const listed = new Set(('deferred' in plan ? plan.deferred ?? [] : []).map(body => body.id));
  // A candidate is a system when the registry holds its star; a registry without it (a partial fixture) has no system for it.
  const hosts = candidates.filter(candidate => ['star', 'black-hole'].includes(registry.get(candidate.id)?.classification ?? ''));
  const solarRadiusM = radii.get(plan.focus.id);
  if (!solarRadiusM) throw new TypeError('The Solar System requires its prepared framing radius.');
  return Object.freeze(hosts.map(({ id, memberIds }) => {
    const host = points.get(id), star = registry.get(id), radiusM = radii.get(id);
    if (!host) throw new TypeError(`site/prepared-world-presentation.json planetarySystems names ${id}, which the world context does not place; run pnpm prepare:world-context.`);
    if (!star || !radiusM) throw new TypeError(`Planetary system ${id} requires a registered star and its prepared framing (site/prepared-world-presentation.json systemFramingRadii); run pnpm prepare:world-presentation.`);
    for (const memberId of memberIds) {
      if (!points.has(memberId) && !listed.has(memberId)) throw new TypeError(`site/prepared-world-presentation.json planetarySystems ${id} lists ${memberId}, which the world context does not place; run pnpm prepare:world-context.`);
      const member = registry.get(memberId);
      if (member && member.systemName !== star.systemName) throw new TypeError(`${memberId} orbits ${star.name} but names its system ${member.systemName}, not ${star.systemName}.`);
    }
    const fade = systemFadeDistances(plan.system, 'orbitsWithinM' in host ? host.orbitsWithinM : undefined);
    return Object.freeze({ id, name: star.systemName, route: star.route, originM: star.worldFrame?.originM ?? host.positionM,
      memberIds: Object.freeze([...memberIds]), radiusM,
      exitDistanceM: Math.min(policy.exitSunDistanceM * radiusM / solarRadiusM, fade.hiddenDistanceM / SYSTEM_OVERVIEW_SPAN) });
  }));
}

interface SystemIndex { readonly systems: readonly PlanetarySystem[]; readonly byId: ReadonlyMap<string, PlanetarySystem>; readonly byMember: ReadonlyMap<string, PlanetarySystem> }
const cache = new WeakMap<object, SystemIndex>();
const indexOf = (objects: Parameters<typeof planetarySystems>[0]) => {
  let index = cache.get(objects);
  if (!index) {
    const systems = planetarySystems(objects);
    const byMember = new Map<string, PlanetarySystem>();
    // The first system to list an id wins, as a scan in system order found it.
    for (const system of systems) for (const id of [system.id, ...system.memberIds]) if (!byMember.has(id)) byMember.set(id, system);
    const byId = new Map<string, PlanetarySystem>();
    for (const system of systems) if (!byId.has(system.id)) byId.set(system.id, system);
    cache.set(objects, index = { systems, byId, byMember });
  }
  return index;
};
const systemsOf = (objects: Parameters<typeof planetarySystems>[0]) => indexOf(objects).systems;
/** The system an object hosts or belongs to; null for a star or body outside every system. */
export function systemOfObject(objects: Parameters<typeof planetarySystems>[0], objectId: string): PlanetarySystem | null {
  return indexOf(objects).byMember.get(objectId) ?? null;
}
export function systemById(objects: Parameters<typeof planetarySystems>[0], systemId: string): PlanetarySystem | null {
  return indexOf(objects).byId.get(systemId) ?? null;
}
export const allPlanetarySystems = systemsOf;
/** The objects systems are built from: the world's bodies (`world-objects.mts`) or the registry. */
export type SystemObjects = Parameters<typeof planetarySystems>[0];
