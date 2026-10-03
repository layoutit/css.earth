import type { NavigationDistance } from './navigation-distance.js';
import type { ObjectClassification, ObjectEntry, ObjectWorldFrame } from './object-schema.js';
import type { ObjectDiscovery } from './object-discovery.js';
import { normalizeDestinationQuery } from './destination-search.js';
import type { OverviewHolding, OverviewZoom } from './overview-object.js';

/**
 * An object of the one registry: a package with a catalogue entry. It has an identity, a place in the world and a scene of
 * its own. A planet, a star, a galaxy and a cluster of galaxies are all this. There is no kind and no other shape. An
 * object that is also a level of the zoom ladder (the Milky Way) carries its place on the ladder as data (`level`).
 */
export type NavigableObject<Scene = unknown, Signal = unknown> = ObjectEntry<Scene, Signal> & {
  readonly aliases: readonly string[];
  /** The one object it is inside (object-tree.ts); only the root has none. */
  readonly parent?: string;
  /** The names an object with alternate names is found by: its id, its name and each alias. */
  readonly searchNames?: readonly string[];
  /** Its place on the zoom ladder, for an object the view hands over to when the camera backs far enough out of a star's
   * system: when it is entered and left, what it holds and the context packages it draws (its package's `overview`). */
  readonly level?: ObjectLevel;
  /** For an object that is a system: the host whose scene shows it, out to the bodies that orbit that host (its package's
   * `system`). A system has an address, a page and a card of its own; it mounts its host's scene. */
  readonly system?: ObjectSystem;
};

/** `members`: what orbits the host. A planet's moons, or a star's planets with everything that orbits them. */
export interface ObjectSystem { readonly host: string; readonly members: 'moons' | 'planets' }
/** A system package's `properties.system`, checked: its host's id and what its members are. Null for any other object. */
export function objectSystem(descriptor: unknown): ObjectSystem | null {
  const properties = typeof descriptor === 'object' && descriptor !== null && 'properties' in descriptor ? (descriptor as { properties?: unknown }).properties : undefined;
  const system = typeof properties === 'object' && properties !== null && 'system' in properties ? (properties as { system?: unknown }).system : undefined;
  if (system === undefined) return null;
  const id = typeof descriptor === 'object' && descriptor !== null && 'id' in descriptor ? String((descriptor as { id?: unknown }).id) : 'unknown';
  const { host, members, ...rest } = (typeof system === 'object' && system !== null ? system : {}) as { host?: unknown; members?: unknown };
  if (typeof host !== 'string' || !/^[a-z0-9][a-z0-9_.+-]*$/u.test(host) || (members !== 'moons' && members !== 'planets') || Object.keys(rest).length) {
    throw new TypeError(`src/objects/${id}/object.json properties.system must be { host: an object id, members: "moons" or "planets" }; got ${JSON.stringify(system)}.`);
  }
  return Object.freeze({ host, members });
}

export interface ObjectLevel {
  readonly order: number;
  readonly zoom: OverviewZoom;
  readonly holds: readonly OverviewHolding[];
  readonly packages: readonly string[];
}

/** What the world context draws, names and selects: every object, and a level that has a place of its own. */
export interface WorldBody {
  readonly id: string;
  readonly name: string;
  readonly classification: ObjectClassification;
  readonly classificationLabel?: string;
  readonly systemName: string;
  readonly color: string;
  readonly distance: NavigationDistance;
  readonly worldFrame: ObjectWorldFrame;
  readonly discovery: Readonly<ObjectDiscovery>;
}

/** The names an object is found by: its id, name and aliases, normalised, with and without spaces. */
export const destinationSearchNames = (names: readonly string[]): string[] => [...new Set(names.flatMap(name => {
  const normalized = normalizeDestinationQuery(name);
  return [normalized, normalized.replaceAll(' ', '')];
}))];
