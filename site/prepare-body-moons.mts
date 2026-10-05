import { SEARCH_OBJECTS } from './search/search-objects.mts';
import type { ObjectEntry } from './objects.mts';
import { systemObjectId } from './navigation/system-address.mts';
import { catalogues } from './moon-catalogue.mts';
export { parseMoonCatalogue, catalogueMoons } from './moon-catalogue.mts';
import { labelEligible } from '@cssearth/renderer/labels/universe-label-policy.ts';

export interface MoonListEntry { id: string; name: string; object?: ObjectEntry; }

/** JPL's Name column is distinct from its provisional designation. Acquisition
 * falls back to that designation only when no proper name has been assigned. */
export function hasProperMoonName(moon: { name: string; provisionalDesignation: string | null }): boolean {
  return labelEligible({ named: moon.name !== moon.provisionalDesignation });
}

/** A host's moons: the moons inside its system in the object tree, nearest the Sun first, or, where its moon catalogue
 * names them, in the catalogue's order with the moons that have no package yet. */
export function prepareBodyMoons(objectId: string): readonly MoonListEntry[] {
  const system = systemObjectId(objectId);
  const available = SEARCH_OBJECTS.filter(object => object.classification === 'satellite' && object.parent === system);
  const catalogue = catalogues[objectId];
  if (!catalogue) return available.map(object => ({ id: object.id, name: object.name, object }));
  const byId = new Map(available.map(object => [object.id, object]));
  const knownIds = new Set(catalogue.moons.map(moon => moon.id));
  for (const object of available) if (!knownIds.has(object.id)) throw new TypeError(`Moon catalogue is missing ${object.id}.`);
  return catalogue.moons.map(moon => ({ ...moon, object: byId.get(moon.id) }));
}
