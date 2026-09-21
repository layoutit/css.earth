import { record } from './browser-types.mts';
import { matchesObjectClassification } from './object-categories.mts';
import { parseArrivalView, type PreparedArrivalView } from './arrival-view.mts';
import { isJplMissionTarget } from './jpl-mission-targets.mts';

export interface ObjectDiscovery { featured: boolean; imagery: boolean; illustration: boolean; arrival?: PreparedArrivalView; orientationReference?: number;
  /** A star without imagery of its own that a body with imagery orbits: its planetary system is on the map. */
  hostsImagery?: true;
  /** A star without imagery whose colour lens comes from its own measurements (a spectrum or a catalogued temperature): on the map. */
  sourceColor?: true; }

export function parseObjectDiscovery(value: unknown): Readonly<ObjectDiscovery> {
  if (!record(value) || Object.keys(value).some(key => !['featured', 'imagery', 'illustration', 'arrival', 'orientationReference', 'hostsImagery', 'sourceColor'].includes(key)) ||
      typeof value.featured !== 'boolean' || typeof value.imagery !== 'boolean' || typeof value.illustration !== 'boolean' ||
      value.illustration && (value.imagery || value.featured)) throw new TypeError('Invalid prepared object discovery.');
  if (value.arrival !== undefined && !value.imagery) throw new TypeError('A photographic arrival requires imagery.');
  if (value.orientationReference !== undefined && (!Number.isInteger(value.orientationReference) || Number(value.orientationReference) < 1)) throw new TypeError('Invalid object orientation reference.');
  if (value.hostsImagery !== undefined && (value.hostsImagery !== true || value.imagery)) throw new TypeError('Only a star without imagery of its own is marked as hosting imagery.');
  if (value.sourceColor !== undefined && (value.sourceColor !== true || value.imagery)) throw new TypeError('Only a body without imagery is marked by its source colour.');
  return Object.freeze({ ...(value.hostsImagery ? { hostsImagery: true as const } : {}), ...(value.sourceColor ? { sourceColor: true as const } : {}), featured: value.featured, imagery: value.imagery, illustration: value.illustration,
    ...(value.arrival === undefined ? {} : { arrival: parseArrivalView(value.arrival) }),
    ...(value.orientationReference === undefined ? {} : { orientationReference: Number(value.orientationReference) }) });
}

export function discoveryDescription(discovery: ObjectDiscovery): string | null {
  return discovery.illustration ? 'Illustration only' : !discovery.imagery ? 'Shape only' : null;
}

export function isDiscoveryAnchor(object: { classification: string }): boolean {
  return object.classification === 'star' || object.classification === 'planet';
}

/** The default context suppresses distant orbit classes and limits asteroid orbits to JPL spacecraft targets. */
export function showsDefaultContextOrbit(object: { id: string; classification: string }): boolean {
  if (['trans-neptunian', 'interstellar'].includes(object.classification)) return false;
  return object.classification !== 'asteroid' || isJplMissionTarget(object);
}

/** Discovery prominence describes prepared content. Asteroid context prominence is instead sourced from JPL. */
export function isDefaultContextFeature(object: { id: string; classification: string; discovery: Pick<ObjectDiscovery, 'featured'> }): boolean {
  if (object.classification === 'asteroid') return isJplMissionTarget(object);
  return object.classification === 'dwarf-planet' || object.discovery.featured;
}

/** Explicit searches still navigate every registered object. This controls the default world. */
export function discoveryVisibility(objects: readonly { id: string; classification: string; discovery: ObjectDiscovery }[],
  options: { illustrations: boolean; highlighted?: string | null;
    /** Phones: an asteroid that is not a mission target draws nothing unless its category is highlighted. */
    compact?: boolean }) {
  const hiddenBodies: string[] = [], hiddenLabels: string[] = [], highlightedBodies: string[] = [];
  for (const object of objects) {
    const illustration = object.discovery.illustration;
    const featured = (!illustration || options.illustrations) && (isDefaultContextFeature(object) || isDiscoveryAnchor(object));
    // A star with only its shape stays off the map until a surface image can be cast; its page still opens from search. A star
    // that a body with imagery orbits stays on it: without the star the planet has no system. So does a star whose colour comes from
    // its own measurements.
    if (object.classification === 'star' && !object.discovery.imagery && !object.discovery.hostsImagery && !object.discovery.sourceColor) { hiddenBodies.push(object.id); hiddenLabels.push(object.id); continue; }
    const highlighted = matchesObjectClassification(object.classification, options.highlighted) && (!illustration || options.illustrations);
    if (highlighted) highlightedBodies.push(object.id);
    if (illustration && !options.illustrations) hiddenBodies.push(object.id);
    else if (options.compact && object.classification === 'asteroid' && !isDefaultContextFeature(object) && !highlighted) hiddenBodies.push(object.id);
    if (!featured && object.classification !== 'satellite' && !highlighted &&
        !(illustration && options.illustrations)) hiddenLabels.push(object.id);
  }
  return { hiddenBodies, hiddenLabels, highlightedBodies };
}
