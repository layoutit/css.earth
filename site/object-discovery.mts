import { record } from './browser-types.mts';
import { matchesObjectClassification } from './object-categories.mts';
import { parseArrivalView, type PreparedArrivalView } from './arrival-view.mts';

export interface ObjectDiscovery { featured: boolean; imagery: boolean; illustration: boolean; arrival?: PreparedArrivalView; }

export function parseObjectDiscovery(value: unknown): Readonly<ObjectDiscovery> {
  if (!record(value) || Object.keys(value).some(key => !['featured', 'imagery', 'illustration', 'arrival'].includes(key)) ||
      typeof value.featured !== 'boolean' || typeof value.imagery !== 'boolean' || typeof value.illustration !== 'boolean' ||
      value.illustration && (value.imagery || value.featured)) throw new TypeError('Invalid prepared object discovery.');
  if (value.arrival !== undefined && !value.imagery) throw new TypeError('A photographic arrival requires imagery.');
  return Object.freeze({ featured: value.featured, imagery: value.imagery, illustration: value.illustration,
    ...(value.arrival === undefined ? {} : { arrival: parseArrivalView(value.arrival) }) });
}

export function discoveryDescription(discovery: ObjectDiscovery): string | null {
  return discovery.illustration ? 'Illustration only' : !discovery.imagery ? 'Shape only' : null;
}

export function isDiscoveryAnchor(object: { classification: string }): boolean {
  return object.classification === 'star' || object.classification === 'planet';
}

/** Explicit searches still navigate every registered object. This controls the default world. */
export function discoveryVisibility(objects: readonly { id: string; classification: string; discovery: ObjectDiscovery }[],
  options: { illustrations: boolean; asteroids: boolean; asteroidLabels: boolean; highlighted?: string | null }) {
  const hiddenBodies: string[] = [], hiddenLabels: string[] = [], highlightedBodies: string[] = [];
  for (const object of objects) {
    const illustration = object.discovery.illustration;
    const featured = object.discovery.featured || isDiscoveryAnchor(object);
    const asteroid = object.classification === 'asteroid';
    const highlighted = matchesObjectClassification(object.classification, options.highlighted) && (!illustration || options.illustrations);
    if (highlighted) highlightedBodies.push(object.id);
    if (illustration ? !options.illustrations : asteroid && !featured && !options.asteroids && !highlighted) hiddenBodies.push(object.id);
    if (!featured && object.classification !== 'satellite' && !highlighted &&
        !(illustration && options.illustrations) && !(asteroid && options.asteroidLabels)) hiddenLabels.push(object.id);
  }
  return { hiddenBodies, hiddenLabels, highlightedBodies };
}
