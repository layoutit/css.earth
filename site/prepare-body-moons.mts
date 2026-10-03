import { SEARCH_OBJECTS } from './search/search-objects.mts';
import type { ObjectEntry } from './objects.mts';
import { systemHostId, systemObjectId } from './navigation/system-address.mts';
import moonCatalogues from './source/moon-catalogues.json' with { type: 'json' };
import { sourceArray, sourceId, sourceObject, sourceText, sourceUnique } from '@cssearth/objects/sources';
import { labelEligible } from '@cssearth/renderer/labels/universe-label-policy.ts';

export interface MoonListEntry { id: string; name: string; object?: ObjectEntry; }

/** JPL's Name column is distinct from its provisional designation. Acquisition
 * falls back to that designation only when no proper name has been assigned. */
export function hasProperMoonName(moon: { name: string; provisionalDesignation: string | null }): boolean {
  return labelEligible({ named: moon.name !== moon.provisionalDesignation });
}

/** Read names from the source catalogue without creating scene objects or invented positions. */
export function parseMoonCatalogue(input: unknown) {
  const catalogue = sourceObject(input);
  const moons = sourceArray(catalogue.moons, value => {
    const moon = sourceObject(value);
    return { id: sourceId(moon.id), name: sourceText(moon.name) };
  });
  sourceUnique(moons.map(moon => moon.id), 'moon identities');
  const count = catalogue.count;
  if (!Number.isInteger(count) || count !== moons.length) throw new TypeError('Moon catalogue count does not match its entries.');
  return { moons };
}

const catalogues: Readonly<Record<string, ReturnType<typeof parseMoonCatalogue>>> = Object.fromEntries(
  moonCatalogues.systems.map(system => [sourceId(system.id), parseMoonCatalogue(system)]));

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

/** A moon with no children points back to its own system instead of an empty list. */
export function prepareBodyRelations(objectId: string) {
  const moons = prepareBodyMoons(objectId);
  if (moons.length) return { label: 'Moons', moons, parent: undefined };
  const object = SEARCH_OBJECTS.find(object => object.id === objectId);
  // A moon is inside its host's system.
  const parentId = object?.classification === 'satellite' && object.parent ? systemHostId(object.parent) ?? undefined : undefined;
  const parent = SEARCH_OBJECTS.find(object => object.id === parentId);
  if (!parent) return null;
  return { label: `${parent.name} system`, parent,
    moons: prepareBodyMoons(parent.id).filter(moon => moon.id !== objectId && moon.object && !moon.object.discovery.illustration) };
}
