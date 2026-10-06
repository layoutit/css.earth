import type { NavigationDistance } from './navigation-distance.js';
import type { ObjectClassification } from './object-classification.js';
import type { ObjectEntry, ObjectWorldFrame } from './object-schema.js';
import type { ObjectDiscovery } from './object-discovery.js';
import { normalizeDestinationQuery } from './destination-search.js';
import type { ObjectZoom } from './object-zoom.js';

/**
 * An object of the one registry: a package with a catalogue entry. It has an identity, a place in the world and a scene of
 * its own. A planet, a star, a galaxy and a cluster of galaxies are all this. There is no kind and no other shape. It is
 * inside one other object (`parent`); an object seen from inside as the camera backs out of it (the Milky Way) carries
 * its zoom facts as data (`zoom`).
 */
export type NavigableObject<Scene = unknown, Signal = unknown> = ObjectEntry<Scene, Signal> & {
  readonly aliases: readonly string[];
  /** The one object it is inside (object-tree.ts); only the root has none. */
  readonly parent?: string;
  /** The names an object with alternate names is found by: its id, its name and each alias. */
  readonly searchNames?: readonly string[];
  /** For an object the view hands over to as the camera backs out of something inside it: when the view enters and leaves
   * it, and how its page frames the camera (its package's `zoom`). */
  readonly zoom?: ObjectZoom;
  /** For an object that is a system: the host whose scene shows it, out to the bodies that orbit that host (its package's
   * `system`). A system has an address, a page and a card of its own; it mounts its host's scene. */
  readonly system?: ObjectSystem;
};

/** A system names its host. What is inside it is the object tree's to say (the objects whose `parent` it is), and what kind
 * of system it is is its classification: a planet's or small body's moons (`satellite-system`), a star's planets
 * (`planetary-system`), a star with only the stars bound to it (`star-system`). */
export interface ObjectSystem { readonly host: string }
/** A system package's `properties.system`, checked: its host's id. Null for any other object. */
export function objectSystem(descriptor: unknown): ObjectSystem | null {
  const properties = typeof descriptor === 'object' && descriptor !== null && 'properties' in descriptor ? (descriptor as { properties?: unknown }).properties : undefined;
  const system = typeof properties === 'object' && properties !== null && 'system' in properties ? (properties as { system?: unknown }).system : undefined;
  if (system === undefined) return null;
  const id = typeof descriptor === 'object' && descriptor !== null && 'id' in descriptor ? String((descriptor as { id?: unknown }).id) : 'unknown';
  const { host, ...rest } = (typeof system === 'object' && system !== null ? system : {}) as { host?: unknown };
  if (typeof host !== 'string' || !/^[a-z0-9][a-z0-9_.+-]*$/u.test(host) || Object.keys(rest).length) {
    throw new TypeError(`src/objects/${id}/object.json properties.system must be { host: an object id }; got ${JSON.stringify(system)}.`);
  }
  return Object.freeze({ host });
}

/** What the world context draws, names and selects: every object with a place of its own. */
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
