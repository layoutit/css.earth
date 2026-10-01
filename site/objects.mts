import { catalogueLevel, defineObjects } from '@cssearth/objects';
import type { CatalogEntry as RegistryCatalogEntry, NavigableObject as RegistryNavigableObject, ObjectEntry as RegistryObjectEntry } from '@cssearth/objects';
import { CATALOGUE_ENTRIES } from './prepared-catalogue.mjs';
import overviews from './prepared-overview-objects.json' with { type: 'json' };
import { objectFromEntry } from './object-directory.mts';
import type { SceneFactory } from './browser/browser-types.mts';

/** The shared registry types, bound to the shell's scene loader and its abort signal. */
export type ObjectEntry = RegistryObjectEntry<SceneFactory, AbortSignal>;
export type CatalogEntry = RegistryCatalogEntry<SceneFactory, AbortSignal>;
export type NavigableObject = RegistryNavigableObject<SceneFactory, AbortSignal>;

/** The single application registry: every entry of the prepared catalogue (`pnpm prepare:catalog`), decoded as a page's
 * object directory decodes the one entry it loads. */
export const OBJECTS = defineObjects<NavigableObject>(CATALOGUE_ENTRIES.map(objectFromEntry));

/** Every object has a scene of its own: the same list, under the name the scene code reads. */
export const SCENE_OBJECTS = OBJECTS;

/** The levels of the zoom ladder, from the nearest out. A level is a view of a scene, not an object: its page is the
 * world host's scene at that zoom. */
export const OVERVIEWS = Object.freeze(overviews.map(catalogueLevel).sort((a, b) => a.order - b.order));
// An id names one page: an object's or a level's.
defineObjects<{ id: string; route: string }>([...OBJECTS, ...OVERVIEWS]);

export function requireObject(id: string) {
  const object = OBJECTS.find(candidate => candidate.id === id);
  if (!object) throw new Error(`Unknown cssEarth object: ${id}`);
  return object;
}

/** What the page `/<id>/` is: an object, or a level of the zoom ladder. */
export function requirePage(id: string): { readonly id: string; readonly name: string; readonly description: string; readonly route: string } {
  return OVERVIEWS.find(level => level.id === id) ?? requireObject(id);
}

export function requireSceneObject(id: string) {
  if (OVERVIEWS.some(level => level.id === id)) throw new TypeError(`${id} is a level of the zoom ladder: it has no scene of its own.`);
  return requireObject(id);
}
