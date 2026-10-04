import { checkObjectTree, defineObjects } from '@cssearth/objects';
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
checkObjectTree(OBJECTS);

/** The objects with a scene of their own: every object but a system, which mounts its host's scene. */
export const SCENE_OBJECTS = Object.freeze(OBJECTS.filter(object => !object.system));

/** Every page a build can prerender, each with the scene it mounts: a system's is its host's (built-pages.mts). */
export const PAGES = Object.freeze(OBJECTS.map(object => Object.freeze({ id: object.id, ...(object.system ? { sceneId: object.system.host } : {}) })));

/** The objects `id` is inside, nearest first: its parent, that one's, out to the Observable Universe. */
export function ancestorsOf(id: string): readonly NavigableObject[] {
  const chain: NavigableObject[] = [];
  for (let parent = requireObject(id).parent; parent !== undefined; parent = requireObject(parent).parent) chain.push(requireObject(parent));
  return chain;
}


export function requireObject(id: string) {
  const object = OBJECTS.find(candidate => candidate.id === id);
  if (!object) throw new Error(`Unknown cssEarth object: ${id}`);
  return object;
}
