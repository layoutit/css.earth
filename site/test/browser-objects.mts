import { OBJECTS } from '../objects.mts';
import type { ObjectEntry } from '../object-schema.mts';

// Routine browser checks walk a representative sample, not the whole registry:
// the Sun, every planet, the Moon and the first member of each other
// classification. Walking all 473 objects at two pixel densities made one
// suite a forty-minute run. CSSEARTH_TEST_OBJECTS=all restores the full walk;
// a comma-separated list of ids selects exactly those objects.
export function browserObjects(all: readonly ObjectEntry[] = OBJECTS): ObjectEntry[] {
  const request = process.env.CSSEARTH_TEST_OBJECTS?.trim();
  if (request === 'all') return [...all];
  if (request) {
    const ids = request.split(',').map(id => id.trim()).filter(Boolean);
    const unknown = ids.filter(id => !all.some(object => object.id === id));
    if (unknown.length) throw new TypeError(`Unknown objects in CSSEARTH_TEST_OBJECTS: ${unknown.join(', ')}.`);
    return all.filter(object => ids.includes(object.id));
  }
  const seen = new Set<string>();
  return all.filter(object => {
    const key = object.classification === 'planet' || object.classification === 'star' || object.id === 'moon' ? object.id : object.classification;
    if (seen.has(key)) return false;
    seen.add(key); return true;
  });
}
