import { startupFetch } from './startup-requests.mts';

/** Each object's prepared entry (`pages/objects/[id]/entry.json.ts`), asked for once whoever reads it: the object
 * directory decodes the object from it, and the world reads from it which holder has the body. A failed read is
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

/** Where the world keeps a body the summary does not hold: its holder, whose file has it (`/world/systems/<holder>.json`),
 * with the body's own row when it is a star that is its own holder of one body, which has no file. */
export interface WorldPlace { readonly holder: string; readonly row?: unknown }
/** A body's place in the world, from its entry's `world`; null for a body the summary holds whole, or no world body. */
export async function readWorldPlace(id: string): Promise<WorldPlace | null> {
  const entry = await readObjectEntry(id);
  const world = entry && typeof entry === 'object' && 'world' in entry ? entry.world : undefined;
  if (world === undefined) return null;
  if (!world || typeof world !== 'object' || !('holder' in world) || typeof world.holder !== 'string') throw new TypeError(`/objects/${id}/entry.json: world must name its holder; got ${JSON.stringify(world)}.`);
  return { holder: world.holder, ...('row' in world ? { row: world.row } : {}) };
}
