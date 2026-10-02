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
  /** The names an object with alternate names is found by: its id, its name and each alias. */
  readonly searchNames?: readonly string[];
  /** Its place on the zoom ladder, for an object the view hands over to when the camera backs far enough out of a star's
   * system: when it is entered and left, what it holds and the context packages it draws (its package's `overview`). */
  readonly level?: ObjectLevel;
};

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
