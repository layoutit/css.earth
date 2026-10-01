import { defineObjects, isOverviewObject, isSceneObject } from '@cssearth/objects';
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
export const OBJECTS = defineObjects<NavigableObject>([...CATALOGUE_ENTRIES, ...overviews].map(objectFromEntry));

/** A capability projection of OBJECTS, never an independently maintained registry. */
export const SCENE_OBJECTS = Object.freeze(OBJECTS.filter(isSceneObject));
for (const object of OBJECTS) if (!isSceneObject(object) && !SCENE_OBJECTS.some(host => host.id === object.sceneHostId)) {
  throw new TypeError(`Scene host is not a registered scene: ${object.id}`);
}

/** The overviews, from the nearest level of the zoom ladder out: a projection of OBJECTS like SCENE_OBJECTS. */
export const OVERVIEWS = Object.freeze(OBJECTS.filter(isOverviewObject)
  .sort((a, b) => a.order - b.order));

export function requireObject(id: string) {
  const object = OBJECTS.find(candidate => candidate.id === id);
  if (!object) throw new Error(`Unknown cssEarth object: ${id}`);
  return object;
}

export function requireSceneObject(id: string) {
  const object = requireObject(id);
  if (!isSceneObject(object)) throw new TypeError(`Object ${id} has no scene of its own.`);
  return object;
}
