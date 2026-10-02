import { startupFetch } from './startup-requests.mts';

/** Each object's prepared entry (`pages/objects/[id]/entry.json.ts`), asked for once whoever reads it: the object
 * directory decodes the object from it, and the world reads the row of a star the summary only lists. A failed read is
 * forgotten, so the next reader asks again. */
const entries = new Map<string, Promise<unknown | null>>();
export function readObjectEntry(id: string): Promise<unknown | null> {
  let entry = entries.get(id);
  if (!entry) {
    entry = (async () => {
      const response = await startupFetch(`/objects/${encodeURIComponent(id)}/entry.json`);
      if (response.status === 404) return null;
      if (!response.ok) throw new Error(`Object entry request for ${id} failed: ${response.status}.`);
      return response.json() as Promise<unknown>;
    })();
    entry.catch(() => { if (entries.get(id) === entry) entries.delete(id); });
    entries.set(id, entry);
  }
  return entry;
}

/** The world row of a plain-dot star nothing orbits, as a system of one body: its entry's `worldSystem`. */
export async function readOwnWorldRow(id: string): Promise<unknown> {
  const entry = await readObjectEntry(id);
  const system = entry && typeof entry === 'object' && 'worldSystem' in entry ? entry.worldSystem : undefined;
  if (system === undefined) throw new TypeError(`/objects/${id}/entry.json: the entry of a star the world summary leaves to it carries no worldSystem.`);
  return system;
}
