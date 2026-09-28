import { isRecord } from '@cssearth/core';
import { matchesObjectClassification } from './object-categories.js';
import { parseArrivalView, type PreparedArrivalView } from './arrival-view.js';

export interface ObjectDiscovery { featured: boolean; imagery: boolean; illustration: boolean; arrival?: PreparedArrivalView; orientationReference?: number;
  /** A star without imagery of its own that a body with imagery orbits: its planetary system is on the map. */
  hostsImagery?: true;
  /** A numerical simulation, qualified separately from an artistic illustration. */
  simulation?: true;
  /** A star without imagery whose colour lens comes from its own measurements (a spectrum or a catalogued temperature): on the map. */
  sourceColor?: true; }

export function parseObjectDiscovery(value: unknown): Readonly<ObjectDiscovery> {
  if (!isRecord(value) || Object.keys(value).some(key => !['featured', 'imagery', 'illustration', 'simulation', 'arrival', 'orientationReference', 'hostsImagery', 'sourceColor'].includes(key)) ||
      typeof value.featured !== 'boolean' || typeof value.imagery !== 'boolean' || typeof value.illustration !== 'boolean' ||
      value.illustration && (value.imagery || value.featured)) throw new TypeError('Invalid prepared object discovery.');
  // Arrival presentation is independent of whether the dataset is photographic.
  if (value.simulation !== undefined && (value.simulation !== true || !value.illustration)) throw new TypeError('A simulation must be a qualified model without observed imagery.');
  if (value.orientationReference !== undefined && (!Number.isInteger(value.orientationReference) || Number(value.orientationReference) < 1)) throw new TypeError('Invalid object orientation reference.');
  if (value.hostsImagery !== undefined && (value.hostsImagery !== true || value.imagery)) throw new TypeError('Only a star without imagery of its own is marked as hosting imagery.');
  if (value.sourceColor !== undefined && (value.sourceColor !== true || value.imagery)) throw new TypeError('Only a body without imagery is marked by its source colour.');
  return Object.freeze({ ...(value.hostsImagery ? { hostsImagery: true as const } : {}), ...(value.sourceColor ? { sourceColor: true as const } : {}), featured: value.featured, imagery: value.imagery, illustration: value.illustration,
    ...(value.simulation ? { simulation: true as const } : {}),
    ...(value.arrival === undefined ? {} : { arrival: parseArrivalView(value.arrival) }),
    ...(value.orientationReference === undefined ? {} : { orientationReference: Number(value.orientationReference) }) });
}

export function discoveryDescription(discovery: ObjectDiscovery): string | null {
  return discovery.simulation ? 'Simulation' : discovery.illustration ? 'Illustration only' : !discovery.imagery ? 'Shape only' : null;
}

export function isDiscoveryAnchor(object: { classification: string }): boolean {
  return object.classification === 'star' || object.classification === 'black-hole' || object.classification === 'planet';
}

/** Explicit searches still navigate every registered object. This controls the default world. */
export function discoveryVisibility(objects: readonly { id: string; classification: string; discovery: ObjectDiscovery }[],
  options: { illustrations: boolean; highlighted?: string | null;
    /** Objects the default view features (prepared: dwarf planets, featured discoveries, JPL mission-target asteroids). */
    defaultFeatures: ReadonlySet<string>;
    /** Phones: an asteroid that is not a mission target draws nothing unless its category is highlighted. */
    compact?: boolean;
    /** Bodies of a system: each body that orbits another, and each body something orbits. */
    systemMembers?: ReadonlySet<string> }) {
  const hiddenBodies: string[] = [], hiddenLabels: string[] = [], highlightedBodies: string[] = [];
  for (const object of objects) {
    const illustration = object.discovery.illustration;
    // A star is named where there is more to find: a notable star (featured: an IAU proper name, or real imagery), or a star
    // of a system, with something orbiting it or orbiting something itself. Every other star is a dot that names itself on
    // hover, so the names on the map point to where there is more to click.
    const namedStar = object.classification !== 'star' || object.discovery.featured || options.systemMembers?.has(object.id) === true;
    const featured = (!illustration || options.illustrations) && (options.defaultFeatures.has(object.id) || isDiscoveryAnchor(object) && namedStar);
    // A star with only its shape stays off the map until a surface image can be cast; its page still opens from search. A star
    // that a body with imagery orbits stays on it: without the star the planet has no system. So does a star whose colour comes from
    // its own measurements.
    if (object.classification === 'star' && !object.discovery.imagery && !object.discovery.hostsImagery && !object.discovery.sourceColor) { hiddenBodies.push(object.id); hiddenLabels.push(object.id); continue; }
    const highlighted = matchesObjectClassification(object.classification, options.highlighted) && (!illustration || options.illustrations);
    if (highlighted) highlightedBodies.push(object.id);
    if (illustration && !options.illustrations) hiddenBodies.push(object.id);
    else if (options.compact && object.classification === 'asteroid' && !options.defaultFeatures.has(object.id) && !highlighted) hiddenBodies.push(object.id);
    if (!featured && object.classification !== 'satellite' && !highlighted &&
        !(illustration && options.illustrations)) hiddenLabels.push(object.id);
  }
  return { hiddenBodies, hiddenLabels, highlightedBodies };
}
