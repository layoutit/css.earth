import { defineObjects, levelOf } from '@cssearth/objects';
import type { CatalogEntry as RegistryCatalogEntry, NavigableObject as RegistryNavigableObject, ObjectEntry as RegistryObjectEntry } from '@cssearth/objects';
import { CATALOGUE_ENTRIES } from './prepared-catalogue.mjs';
import { objectFromEntry } from './object-directory.mts';
import type { SceneFactory } from './browser/browser-types.mts';

/** The shared registry types, bound to the shell's scene loader and its abort signal. */
export type ObjectEntry = RegistryObjectEntry<SceneFactory, AbortSignal>;
export type CatalogEntry = RegistryCatalogEntry<SceneFactory, AbortSignal>;
export type NavigableObject = RegistryNavigableObject<SceneFactory, AbortSignal>;

/** The single application registry: every entry of the prepared catalogue (`pnpm prepare:catalog`), decoded as a page's
 * object directory decodes the one entry it loads. */
export const OBJECTS = defineObjects<NavigableObject>(CATALOGUE_ENTRIES.map(objectFromEntry));

/** The objects with a scene of their own: every object but a system, which mounts its host's scene. */
export const SCENE_OBJECTS = Object.freeze(OBJECTS.filter(object => !object.system));

/** Every page a build can prerender, each with the scene it mounts: a system's is its host's (built-pages.mts). */
export const PAGES = Object.freeze(OBJECTS.map(object => Object.freeze({ id: object.id, ...(object.system ? { sceneHostId: object.system.host } : {}) })));

/** The levels of the zoom ladder, from the nearest out: the objects that are levels, as the ladder reads them. */
export const OVERVIEWS = Object.freeze(OBJECTS.filter(object => object.level).map(levelOf).sort((a, b) => a.order - b.order));

export function requireObject(id: string) {
  const object = OBJECTS.find(candidate => candidate.id === id);
  if (!object) throw new Error(`Unknown cssEarth object: ${id}`);
  return object;
}

export const requireSceneObject = requireObject;
