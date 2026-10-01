import type { NavigationDistance } from './navigation-distance.js';
import type { ObjectClassification, ObjectEntry, ObjectWorldFrame } from './object-schema.js';
import type { ObjectDiscovery } from './object-discovery.js';
import { normalizeDestinationQuery } from './destination-search.js';

/**
 * An object of the one registry: a package with a catalogue entry. It has an identity, a place in the world and a scene of
 * its own. A planet, a star, a galaxy and a cluster of galaxies are all this. There is no kind and no other shape; a level
 * of the zoom ladder is a view of a scene (overview-object.ts), not an object.
 */
export type NavigableObject<Scene = unknown, Signal = unknown> = ObjectEntry<Scene, Signal> & {
  readonly aliases: readonly string[];
  /** The names an object with alternate names is found by: its id, its name and each alias. */
  readonly searchNames?: readonly string[];
};

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
