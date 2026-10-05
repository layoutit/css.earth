import { importPackagedObjectRuntime } from './scene-imports.mts';
import { catalogueObject, objectSystem, systemHostId } from '@cssearth/objects';
import type { NavigableObject, ObjectEntry } from './directory/object-entry-types.mts';
import { readObjectEntry } from './directory/object-entries.mts';

/** The objects a page knows, read one at a time from their prepared entries (`pages/objects/[id]/entry.json.ts`) the first
 * time the page needs them: its own, the objects it is inside, the Sun's, and whatever it navigates to. A page never loads
 * the whole registry, so an object added to the universe costs nothing on any other page. Both lists are live: consumers
 * that search them find every object loaded so far. The build and the search function seed them from the full registry
 * (`seedObjectDirectory`). */
export const NAVIGABLE_OBJECTS: NavigableObject[] = [];
/** The same live list, under the name the scene code reads: it only ever holds the objects a page mounted or loaded,
 * and the scene code asks it for hosts (a system mounts its host's scene). */
export const SCENE_OBJECTS: ObjectEntry[] = NAVIGABLE_OBJECTS;

const loading = new Map<string, Promise<NavigableObject | null>>();
function add(object: NavigableObject) {
  if (NAVIGABLE_OBJECTS.some(known => known.id === object.id)) return;
  NAVIGABLE_OBJECTS.push(object);
}
/** The object with `id` if the page has loaded it. */
export const knownObject = (id: string): NavigableObject | undefined => NAVIGABLE_OBJECTS.find(object => object.id === id);
/** The objects `id` is inside that the page has loaded, nearest first: its parent, that one's, out to the Observable Universe. */
export function knownAncestors(id: string): readonly NavigableObject[] {
  const chain: NavigableObject[] = [];
  for (let parent = knownObject(id)?.parent; parent !== undefined; parent = knownObject(parent)?.parent) {
    const object = knownObject(parent);
    if (!object) break;
    chain.push(object);
  }
  return chain;
}
/** The ids of the objects `id` is inside, nearest first, as its own entry names them (`ancestors`): no other entry is read. */
export async function ancestorIds(id: string, read: (id: string) => Promise<unknown | null> = fetchEntry): Promise<readonly string[]> {
  const entry = await read(id);
  const listed: unknown = entry && typeof entry === 'object' && 'ancestors' in entry ? entry.ancestors : [];
  if (!Array.isArray(listed) || !listed.every((value): value is string => typeof value === 'string')) {
    throw new TypeError(`/objects/${id}/entry.json: ancestors must be a list of object ids; got ${JSON.stringify(listed)}.`);
  }
  return listed;
}
/** Loads the objects `id` is inside, together: its entry names them (`ancestors`), so none waits for another. `id` is
 * loaded too, from the entry just read: the chain starts at its parent (`knownAncestors`), so without it the chain of a
 * star the page has not mounted (the Sun, on a planet's page) was empty and a zoom out of that planet followed nothing
 * past the star's system until the camera rested (2026-10-03). */
export async function loadAncestors(id: string, read: (id: string) => Promise<unknown | null> = fetchEntry): Promise<readonly NavigableObject[]> {
  const ids = await ancestorIds(id, read);
  await Promise.all([id, ...ids].map(each => loadObject(each, read)));
  return knownAncestors(id);
}
/** Loads the object `id`, with any system it hosts, is inside: the nearest one that is no system (its galaxy; the Milky
 * Way's is read at startup). Zooming out of `id` hands the view to it when it has a scene of its own (inside-view.mts
 * `insideBody`), and nothing else it is inside is read for that. */
export async function loadHolder(id: string, read: (id: string) => Promise<unknown | null> = fetchEntry): Promise<NavigableObject | null> {
  const holder = (await ancestorIds(id, read)).find(ancestor => systemHostId(ancestor) === null);
  return holder === undefined ? null : loadObject(holder, read);
}

/** The body the walls of `id` surround, as its entry names it (`inner`), once the page has read it (`loadInner`). */
const inner = new Map<string, string>();
export const knownInner = (id: string): NavigableObject | undefined => { const body = inner.get(id); return body === undefined ? undefined : knownObject(body); };
/** Loads the body the walls of `id` surround, when its entry names one: a zoom in on `id` hands the view to it
 * (overview-selection.mts). Null for an object that names none. */
export async function loadInner(id: string, read: (id: string) => Promise<unknown | null> = fetchEntry): Promise<NavigableObject | null> {
  const entry = await read(id), named: unknown = entry && typeof entry === 'object' && 'inner' in entry ? entry.inner : undefined;
  if (named === undefined) return null;
  if (typeof named !== 'string') throw new TypeError(`/objects/${id}/entry.json: inner must be an object id; got ${JSON.stringify(named)}.`);
  const body = await loadObject(named, read);
  if (body) inner.set(id, named);
  return body;
}

/** A prepared catalogue entry as the directory serves it (`@cssearth/objects` catalogueObject), bound to the shell's scene loader. */
export function objectFromEntry(value: unknown): NavigableObject {
  return catalogueObject(value, descriptor => async (signal?: AbortSignal) => {
    // A system mounts its host's scene (its package's `system.host`).
    const system = objectSystem(descriptor);
    if (system) {
      const host = await loadObject(system.host);
      if (!host) throw new Error(`System ${String(descriptor.id)} is hosted by ${system.host}, which has no prepared entry.`);
      return host.loadScene(signal);
    }
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
function fetchEntry(id: string) { return readObjectEntry(id); }

/** The build, the search function and tests hold the full registry; they seed the directory with it. */
export function seedObjectDirectory(objects: readonly NavigableObject[]) {
  for (const object of objects) add(object);
}
