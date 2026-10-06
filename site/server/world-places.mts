import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { APPLICATION_WORLD_INDEX, APPLICATION_WORLD_FILE_OF } from '../world-context-plan.mts';
import { OBJECTS } from '../objects.mts';

/** The build's reading of the world's files, in Node only: what each page, object entry and world endpoint says of where a
 * body's row is. Every world body is in the file of the object it is inside (`summarizeWorldContext` in @cssearth/bake);
 * this reads the files and the object tree, and keeps no table of holders of its own. A page never reads these. */
function index() {
  if (!APPLICATION_WORLD_INDEX) throw new TypeError('The world index is the build\'s: only Node reads src/objects/observable-universe/prepared/world-index.json.');
  return APPLICATION_WORLD_INDEX;
}
const parents = new Map(OBJECTS.map(object => [object.id, object.parent] as const));
const fileFlags = new Map<string, { readonly anywhere: boolean; readonly places: boolean }>();
const flagsOf = (id: string) => {
  let flags = fileFlags.get(id);
  if (!flags) {
    const file = JSON.parse(readFileSync(resolve(process.cwd(), `src/objects/${id}/prepared/members.json`), 'utf8')) as { anywhere?: unknown; places?: unknown };
    fileFlags.set(id, flags = { anywhere: file.anywhere === true, places: file.places === true });
  }
  return flags;
};

/** Every object with a file of world bodies (its own package's `prepared/members.json`), from the root of the tree down. */
export const worldFiles = (): readonly string[] => index().files;
/** Every object whose children's files are read on approach (its own package's `prepared/places.json`). */
export const worldPlaceFiles = (): readonly string[] => worldFiles().filter(id => flagsOf(id).places);

/** The files object `id` needs, root first: its own and those of the objects it is inside (an object's file has its
 * children; a system's has what orbits its host, Earth's system the Moon), with the file its own row is in. */
function chainFiles(id: string): readonly string[] {
  const chain = new Set<string>();
  for (let at: string | undefined = id; at !== undefined; at = parents.get(at)) chain.add(at);
  const file = APPLICATION_WORLD_FILE_OF.get(id);
  if (file !== undefined) chain.add(file);
  return worldFiles().filter(entry => chain.has(entry));
}

/** Where the world keeps body `id`: the files to read for it, root first, and its own row when it is a plain-dot star with
 * nothing round it (its object entry carries it). Null for an object that is no world body. */
export function worldPlaceOf(id: string): { readonly files: readonly string[]; readonly row?: unknown } | null {
  if (Object.hasOwn(index().rows, id)) return { files: chainFiles(id), row: index().rows[id] };
  return APPLICATION_WORLD_FILE_OF.has(id) ? { files: chainFiles(id) } : null;
}

/** Every file whose bodies the map draws from anywhere (or that has places), root first: every page reads them at startup,
 * together in one response (`pages/world/anywhere.json.ts`). */
export const worldAnywhereFiles = (): readonly string[] => worldFiles().filter(file => flagsOf(file).anywhere);
/** The other files page `id` reads at startup, root first: its own object's and those of the objects it is inside. */
export function worldStartupFiles(id: string): readonly string[] {
  return chainFiles(id).filter(file => !flagsOf(file).anywhere);
}

/** The files a page does not read at startup that have bodies of `ids` (a category's marked members): read when that
 * category is highlighted. */
export function worldFilesOf(ids: Iterable<string>): readonly string[] {
  return [...new Set([...ids].flatMap(id => { const file = APPLICATION_WORLD_FILE_OF.get(id); return file === undefined || flagsOf(file).anywhere ? [] : [file]; }))].sort();
}
