import { importPackagedObjectRuntime } from './import-queue.mts';
import { catalogueLevel, catalogueObject, isSceneDescriptor } from '@cssearth/objects';
import type { OverviewObject } from '@cssearth/objects';
import type { NavigableObject, ObjectEntry } from './objects.mts';
import overviews from './prepared-overview-objects.json' with { type: 'json' };
import { startupFetch } from './startup-requests.mts';

/** The objects a page knows, read one at a time from their prepared entries (`pages/objects/[id]/entry.json.ts`) the first
 * time the page needs them: its own, the Sun's, and whatever it navigates to. A page never loads the whole registry, so an
 * object added to the universe costs nothing on any other page. The overviews are the exception: every URL is read against
 * them (a path names either an object or a level), so the directory starts with their few entries. Both lists are live: consumers that search them find
 * every object loaded so far. The build and the search function seed them from the full registry (`seedObjectDirectory`). */
export const NAVIGABLE_OBJECTS: NavigableObject[] = [];
/** Every object has a scene of its own: the same live list, under the name the scene code reads. */
export const SCENE_OBJECTS: ObjectEntry[] = NAVIGABLE_OBJECTS;

const loading = new Map<string, Promise<NavigableObject | null>>();
function add(object: NavigableObject) {
  if (NAVIGABLE_OBJECTS.some(known => known.id === object.id)) return;
  NAVIGABLE_OBJECTS.push(object);
}
/** The overviews, from the nearest level of the zoom ladder out: every page knows them (see above). The build's registry
 * holds the same entries (objects.mts OVERVIEWS). */
export const KNOWN_OVERVIEWS: readonly OverviewObject[] = Object.freeze(overviews.map(catalogueLevel).sort((a, b) => a.order - b.order));
// A level that is an object too (the Milky Way) is known as one from the start: its row is its catalogue entry.
for (const row of overviews) if (isSceneDescriptor((row as { descriptor?: unknown }).descriptor)) add(objectFromEntry(row));
/** The level with `id`, when `id` names one. */
export const knownLevel = (id: string | null | undefined): OverviewObject | undefined => KNOWN_OVERVIEWS.find(level => level.id === id);
/** The object with `id` if the page has loaded it. */
export const knownObject = (id: string): NavigableObject | undefined => NAVIGABLE_OBJECTS.find(object => object.id === id);

/** A prepared catalogue entry as the directory serves it (`@cssearth/objects` catalogueObject), bound to the shell's scene loader. */
export function objectFromEntry(value: unknown): NavigableObject {
  return catalogueObject(value, descriptor => async (signal?: AbortSignal) => {
    const { loadPackagedObject } = await importPackagedObjectRuntime();
    return loadPackagedObject(descriptor, signal);
  });
}

/** Load the object with `id` once; null when it is not a navigable object. A failed read is forgotten, so the next asks again. */
export function loadObject(id: string, read: (id: string) => Promise<unknown | null> = fetchEntry): Promise<NavigableObject | null> {
  const known = knownObject(id);
  if (known) return Promise.resolve(known);
  if (!/^[a-z0-9][a-z0-9_.+-]*$/u.test(id)) return Promise.resolve(null);
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
  const response = await startupFetch(`/objects/${id}/entry.json`);
  if (response.status === 404) return null;
  if (!response.ok) throw new Error(`Object entry request for ${id} failed: ${response.status}.`);
  return response.json();
}

/** The build, the search function and tests hold the full registry; they seed the directory with it. */
export function seedObjectDirectory(objects: readonly NavigableObject[]) {
  for (const object of objects) add(object);
}
