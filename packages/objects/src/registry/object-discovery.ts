import { isPlacedClassification } from './object-classification.js';
import { isRecord } from '@cssearth/core';
import { matchesObjectClassification } from './object-categories.js';
import { parseArrivalView, type PreparedArrivalView } from './arrival-view.js';

export interface ObjectDiscovery { featured: boolean; imagery: boolean; illustration: boolean; arrival?: PreparedArrivalView; orientationReference?: number;
  /** A star without imagery of its own that a body with imagery orbits: its planetary system is on the map. */
  hostsImagery?: true;
  /** A numerical simulation, qualified separately from an artistic illustration. */
  simulation?: true;
  /** A star without imagery whose color dataset comes from its own measurements (a spectrum or a catalogued temperature): on the map. */
  sourceColor?: true; }

export function parseObjectDiscovery(value: unknown): Readonly<ObjectDiscovery> {
  if (!isRecord(value) || Object.keys(value).some(key => !['featured', 'imagery', 'illustration', 'simulation', 'arrival', 'orientationReference', 'hostsImagery', 'sourceColor'].includes(key)) ||
      typeof value.featured !== 'boolean' || typeof value.imagery !== 'boolean' || typeof value.illustration !== 'boolean' ||
      value.illustration && (value.imagery || value.featured)) throw new TypeError('Invalid prepared object discovery.');
  // Arrival presentation is independent of whether the dataset is photographic.
  if (value.simulation !== undefined && (value.simulation !== true || !value.illustration)) throw new TypeError('A simulation must be a qualified model without observed imagery.');
  if (value.orientationReference !== undefined && (!Number.isInteger(value.orientationReference) || Number(value.orientationReference) < 1)) throw new TypeError('Invalid object orientation reference.');
  if (value.hostsImagery !== undefined && (value.hostsImagery !== true || value.imagery)) throw new TypeError('Only a star without imagery of its own is marked as hosting imagery.');
  if (value.sourceColor !== undefined && (value.sourceColor !== true || value.imagery)) throw new TypeError('Only a body without imagery is marked by its source color.');
  return Object.freeze({ ...(value.hostsImagery ? { hostsImagery: true as const } : {}), ...(value.sourceColor ? { sourceColor: true as const } : {}), featured: value.featured, imagery: value.imagery, illustration: value.illustration,
    ...(value.simulation ? { simulation: true as const } : {}),
    ...(value.arrival === undefined ? {} : { arrival: parseArrivalView(value.arrival) }),
    ...(value.orientationReference === undefined ? {} : { orientationReference: Number(value.orientationReference) }) });
}

export function discoveryDescription(discovery: ObjectDiscovery): string | null {
  return discovery.simulation ? 'Simulation' : discovery.illustration ? 'Illustration only' : !discovery.imagery ? 'Shape only' : null;
}

/** A star with only its shape stays off the map until a surface image can be cast; its page still opens from search. A star
 * that a body with imagery orbits stays on it: without the star the planet has no system. So does a star whose color comes from
 * its own measurements. */
export function offTheMap(object: { classification: string; discovery: ObjectDiscovery }): boolean {
  return object.classification === 'star' && !object.discovery.imagery && !object.discovery.hostsImagery && !object.discovery.sourceColor;
}

export function isDiscoveryAnchor(object: { classification: string }): boolean {
  // A placed body (a star, a black hole, a galaxy, a cluster, a nebula) is a place of its own scale; a planet is one of its system.
  return isPlacedClassification(object.classification) || object.classification === 'planet';
}

type DiscoveryObjects = readonly { id: string; classification: string; discovery: ObjectDiscovery }[];
export interface DiscoveryVisibilityOptions {
  illustrations: boolean; highlighted?: string | null;
  /** The highlighted category's notable members when its pill marks only those (prepared with its frame); a page passes the same
   * set for the same category. */
  highlightedIds?: ReadonlySet<string>;
  /** Objects the default view features (prepared: dwarf planets, featured discoveries, JPL mission-target asteroids). */
  defaultFeatures: ReadonlySet<string>;
  /** Bodies of a system: each body that orbits another, and each body something orbits. */
  systemMembers?: ReadonlySet<string>;
  /** Bodies the map shows as named dots, placed by their measured orbit, even when their page is only an illustration (extreme
   * trans-Neptunian objects). */
  orbitFeatures?: ReadonlySet<string>;
}
export interface DiscoveryVisibility { readonly hiddenBodies: readonly string[]; readonly hiddenLabels: readonly string[]; readonly highlightedBodies: readonly string[] }

// A page's objects and sets are fixed once it loads, and its settings take a handful of values (illustrations and one
// highlighted classification), so each combination is computed once over the page's ~3,600 bodies and then reused.
const visibilityCache = new WeakMap<DiscoveryObjects, { defaultFeatures: ReadonlySet<string>; systemMembers?: ReadonlySet<string>;
  orbitFeatures?: ReadonlySet<string>; results: Map<string, DiscoveryVisibility> }[]>();

/** Explicit searches still navigate every registered object. This controls the default world. The objects and sets are read as
 * fixed: a caller passes the same instances for the same page, and the result for each setting combination is cached (frozen). */
export function discoveryVisibility(objects: DiscoveryObjects, options: DiscoveryVisibilityOptions): DiscoveryVisibility {
  let inputs = visibilityCache.get(objects);
  if (!inputs) visibilityCache.set(objects, inputs = []);
  let entry = inputs.find(item => item.defaultFeatures === options.defaultFeatures && item.systemMembers === options.systemMembers && item.orbitFeatures === options.orbitFeatures);
  if (!entry) inputs.push(entry = { defaultFeatures: options.defaultFeatures, systemMembers: options.systemMembers, orbitFeatures: options.orbitFeatures, results: new Map() });
  const key = JSON.stringify([options.illustrations, options.highlighted ?? null, options.highlightedIds?.size ?? null]);
  let result = entry.results.get(key);
  if (!result) entry.results.set(key, result = computeDiscoveryVisibility(objects, options));
  return result;
}

function computeDiscoveryVisibility(objects: DiscoveryObjects, options: DiscoveryVisibilityOptions): DiscoveryVisibility {
  const hiddenBodies: string[] = [], hiddenLabels: string[] = [], highlightedBodies: string[] = [];
  for (const object of objects) {
    const illustration = object.discovery.illustration && options.orbitFeatures?.has(object.id) !== true;
    // A star is named where there is more to find: a notable star (featured: marked so by its package, or real imagery), or a star
    // of a system, with something orbiting it or orbiting something itself. Every other star is a dot that names itself on
    // hover, so the names on the map point to where there is more to click.
    const namedStar = object.classification !== 'star' || object.discovery.featured || options.systemMembers?.has(object.id) === true;
    const featured = (!illustration || options.illustrations) && (options.defaultFeatures.has(object.id) || isDiscoveryAnchor(object) && namedStar);
    if (offTheMap(object)) { hiddenBodies.push(object.id); hiddenLabels.push(object.id); continue; }
    const highlighted = matchesObjectClassification(object.classification, options.highlighted) && (!illustration || options.illustrations)
      && (!options.highlightedIds || options.highlightedIds.has(object.id));
    if (highlighted) highlightedBodies.push(object.id);
    if (illustration && !options.illustrations) hiddenBodies.push(object.id);
    // An asteroid that is not a mission target has no marker of its own unless its category is highlighted: it is one of
    // the dots of a catalogue point bank.
    else if (object.classification === 'asteroid' && !options.defaultFeatures.has(object.id) && !highlighted) hiddenBodies.push(object.id);
    if (!featured && object.classification !== 'satellite' && !highlighted &&
        !(illustration && options.illustrations)) hiddenLabels.push(object.id);
  }
  return Object.freeze({ hiddenBodies: Object.freeze(hiddenBodies), hiddenLabels: Object.freeze(hiddenLabels), highlightedBodies: Object.freeze(highlightedBodies) });
}
