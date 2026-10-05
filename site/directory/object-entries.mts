import { startupFetch } from './startup-requests.mts';

/** Each object's prepared entry (`pages/objects/[id]/entry.json.ts`), asked for once whoever reads it: the object
 * directory decodes the object from it, and the world reads from it which holder has the body. A failed read is
 * forgotten, so the next reader asks again. */
const entries = new Map<string, Promise<unknown | null>>();
// Every entry read so far, and who is told of each: the world declares the banks an entry carries (`banks`).
const read = new Map<string, unknown>(), listeners = new Set<(id: string, entry: unknown) => void>();
/** Calls `listener` with each entry read so far, then with each one read later; returns the unsubscribe. */
export function onObjectEntry(listener: (id: string, entry: unknown) => void): () => void {
  for (const [id, entry] of read) listener(id, entry);
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}
export function readObjectEntry(id: string): Promise<unknown | null> {
  let entry = entries.get(id);
  if (!entry) {
    entry = (async () => {
      const response = await startupFetch(`/objects/${encodeURIComponent(id)}/entry.json`);
      if (response.status === 404) return null;
      if (!response.ok) throw new Error(`Object entry request for ${id} failed: ${response.status}.`);
      const value: unknown = await response.json();
      // Told before any reader continues: a scene mounts only after its entry is read, so its banks are declared by then.
      read.set(id, value);
      for (const listener of listeners) listener(id, value);
      return value;
    })();
    entry.catch(() => { if (entries.get(id) === entry) entries.delete(id); });
    entries.set(id, entry);
  }
  return entry;
}

/** Where the world keeps a body: the files to read for it, root first (`/world/systems/<id>.json`: the file of the object it
 * is inside and those of the objects that one is inside), with the body's own row when it is a plain-dot star with nothing
 * round it, which no file has. */
export interface WorldPlace { readonly files: readonly string[]; readonly row?: unknown }
/** A body's place in the world, from its entry's `world`; null for an object that is no world body. */
export async function readWorldPlace(id: string): Promise<WorldPlace | null> {
  const entry = await readObjectEntry(id);
  const world = entry && typeof entry === 'object' && 'world' in entry ? entry.world : undefined;
  if (world === undefined) return null;
  if (!world || typeof world !== 'object' || !('files' in world) || !Array.isArray(world.files) || !world.files.every(file => typeof file === 'string')) {
    throw new TypeError(`/objects/${id}/entry.json: world must name the files to read for it; got ${JSON.stringify(world)}.`);
  }
  return { files: world.files as string[], ...('row' in world ? { row: world.row } : {}) };
}
