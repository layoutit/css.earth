import { catalogEntry } from './object-catalog.mts';
import { parseObjectDiscovery } from './object-discovery.mts';
import { parseNavigationDistance } from './navigation/navigation-distance.mts';
import { definePreparedFocus, isSceneObject, type NavigableObject } from './prepared-focus-object.mts';
import type { ObjectEntry } from './object-schema.mts';
import { record } from './browser-types.mts';

/** The objects a page knows, read one at a time from their prepared entries (`pages/objects/[id]/entry.json.ts`) the first
 * time the page needs them: its own, the Sun's, and whatever it navigates to. A page never loads the whole registry, so an
 * object added to the universe costs nothing on any other page. Both lists are live: consumers that search them find
 * every object loaded so far. The build and the search function seed them from the full registry (`seedObjectDirectory`). */
export const NAVIGABLE_OBJECTS: NavigableObject[] = [];
export const SCENE_OBJECTS: ObjectEntry[] = [];

const loading = new Map<string, Promise<NavigableObject | null>>();
function add(object: NavigableObject) {
  if (NAVIGABLE_OBJECTS.some(known => known.id === object.id)) return;
  NAVIGABLE_OBJECTS.push(object);
  if (isSceneObject(object)) SCENE_OBJECTS.push(object);
}
/** Whether a loaded object owns a scene. */
export const isLoadedScene = isSceneObject;
/** The object with `id` if the page has loaded it. */
export const knownObject = (id: string): NavigableObject | undefined => NAVIGABLE_OBJECTS.find(object => object.id === id);

/** A prepared entry as the directory serves it: a scene object's descriptor with its navigation distance and discovery,
 * or a prepared focus. */
export function objectFromEntry(value: unknown): NavigableObject {
  if (!record(value)) throw new TypeError('Invalid object entry.');
  if (value.kind === 'prepared-focus') return definePreparedFocus(value.focus);
  if (value.kind !== 'scene' || !record(value.descriptor)) throw new TypeError('Invalid object entry.');
  const descriptor = value.descriptor;
  const { order: _order, context: _context, ...object } = catalogEntry(descriptor, async signal => {
    const { loadPackagedObject } = await import('./packaged-object-runtime.mts');
    return loadPackagedObject(descriptor, signal);
  }, parseNavigationDistance(value.distance), parseObjectDiscovery(value.discovery));
  return object;
}

/** Load the object with `id` once; null when it is not a navigable object. A failed read is forgotten, so the next asks again. */
export function loadObject(id: string, read: (id: string) => Promise<unknown | null> = fetchEntry): Promise<NavigableObject | null> {
  const known = knownObject(id);
  if (known) return Promise.resolve(known);
  if (!/^[a-z0-9][a-z0-9-]*$/u.test(id)) return Promise.resolve(null);
  let pending = loading.get(id);
  if (!pending) {
    pending = read(id).then(value => {
      if (value === null) return null;
      const object = objectFromEntry(value);
      if (object.id !== id) throw new TypeError(`The entry for ${id} names ${object.id}.`);
      add(object);
      return object;
    }).catch(error => { loading.delete(id); throw error; });
    loading.set(id, pending);
  }
  return pending;
}
async function fetchEntry(id: string): Promise<unknown | null> {
  const response = await fetch(`/objects/${id}/entry.json`);
  if (response.status === 404) return null;
  if (!response.ok) throw new Error(`Object entry request for ${id} failed: ${response.status}.`);
  return response.json();
}

/** The build, the search function and tests hold the full registry; they seed the directory with it. */
export function seedObjectDirectory(objects: readonly NavigableObject[]) {
  for (const object of objects) add(object);
}
