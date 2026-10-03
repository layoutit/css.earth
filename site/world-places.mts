import { APPLICATION_WORLD_CONTEXT, APPLICATION_WORLD_INDEX } from './world-context-plan.mts';
import { systemHostId, systemObjectId } from '@cssearth/objects';

/** The build's reading of the bake's world index (`world-index.json`), in Node only: what each page, object entry and
 * world endpoint says of a body's holder. A page never reads the index. */
function index() {
  if (!APPLICATION_WORLD_INDEX) throw new TypeError('The world index is the build\'s: only Node reads src/objects/sun/prepared/world-index.json.');
  return APPLICATION_WORLD_INDEX;
}
/** The rounding of a holder star's place in `/world/hosts.json`, in metres. */
const APPROACH_ROUNDING_M = 1e12;
let holders: ReadonlySet<string> | null = null;
const holderIds = () => holders ??= new Set(Object.values(index().holders));

/** Every holder that is a file (its own package's `prepared/members.json`), in id order: each star something orbits, and the asteroid dot
 * bank. A star that is its own holder of one body has its row in the index and no file. */
export function worldHolderFiles(): readonly string[] {
  return [...holderIds()].filter(id => !Object.hasOwn(index().rows, id)).sort();
}
/** Where the world keeps `id`: its holder, with its own row when it is a star that is its own holder of one body. Null
 * for a body the summary holds with everything that orbits it, and for an object that is no world body. */
export function worldPlaceOf(id: string): { readonly holder: string; readonly row?: unknown } | null {
  // A body outside the summary names its holder; a star the summary holds, with planets, names its system's.
  const holder = index().holders[id] ?? (holderIds().has(systemObjectId(id)) ? systemObjectId(id) : holderIds().has(id) ? id : undefined);
  if (holder === undefined) return null;
  return Object.hasOwn(index().rows, holder) ? { holder, row: index().rows[holder] } : { holder };
}
/** Each holder file's star, where it is and the range its orbits are authored to when it has one
 * (`pages/world/hosts.json.ts`), as columns: what the camera's approach is measured against (world-approach.mts). */
export function worldHolderReaches() {
  const bodies = new Map(APPLICATION_WORLD_CONTEXT.bodies.map(body => [body.id, body]));
  // A holder that is no body of the world (a dot bank's object) is never approached: its bodies are its dots until one is
  // opened or their category is highlighted.
  const rows = worldHolderFiles().flatMap(id => {
    // A system's holder is approached at its star.
    const body = bodies.get(systemHostId(id) ?? id);
    // To the nearest 1e12 m: an approach is measured against a system's fade distance, 1e16 m or more.
    return body ? [{ id, positionM: body.positionM.map(value => Math.round(value / APPROACH_ROUNDING_M) * APPROACH_ROUNDING_M), orbitsWithinM: body.orbitsWithinM ?? null }] : [];
  });
  return { id: rows.map(row => row.id), positionM: rows.map(row => row.positionM), orbitsWithinM: rows.map(row => row.orbitsWithinM) };
}
/** The holder files that have bodies of `ids` (a category's marked members): read when that category is highlighted. */
export function worldHolderFilesOf(ids: Iterable<string>): readonly string[] {
  const files = new Set(worldHolderFiles());
  return [...new Set([...ids].flatMap(id => { const holder = index().holders[id]; return holder !== undefined && files.has(holder) ? [holder] : []; }))].sort();
}
