/** An object's unsaved edits: a working copy of its tracked recipe in the ignored `src/objects/<id>/.local/lab/`.
 * Edits, Undo and Reset write the working copy; drafts and the viewer read it; only Save writes the tracked
 * `source/recipe.json`, and only the numbers the working copy changed; Discard deletes it. The working copy keeps the
 * tracked text it started from (`base.json`): its changes are the numbers that differ from that base, so a change the
 * tracked recipe takes meanwhile is kept, never reverted by a Save. The CLI and the lab server both call these. */
import { isRecord } from '@cssearth/core';
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { setRecipeNumber } from './recipe-text.ts';

export interface RecipeChange { path: string; from: number; to: number }
export interface RecipeState { recipe: unknown; working: boolean; changes: RecipeChange[] }

const ID = /^[a-z0-9][a-z0-9-]*$/;
function objectDirectory(root: string, id: string) {
  if (!ID.test(id)) throw new TypeError(`An object id is a src/objects folder name; got ${JSON.stringify(id)}.`);
  return resolve(root, 'src/objects', id);
}
export const labDirectory = (root: string, id: string) => resolve(objectDirectory(root, id), '.local/lab');
export const trackedRecipePath = (root: string, id: string) => resolve(objectDirectory(root, id), 'source/recipe.json');
export const workingRecipePath = (root: string, id: string) => resolve(labDirectory(root, id), 'recipe.json');
const basePath = (root: string, id: string) => resolve(labDirectory(root, id), 'base.json');

const missing = (error: NodeJS.ErrnoException) => { if (error.code === 'ENOENT') return null; throw error; };
const readText = (path: string) => readFile(path, 'utf8').catch(missing);

/** Every number that differs between two recipes, by dotted path. Anything else that differs is not an edit the
 * working copy can carry, so it refuses. */
export function recipeChanges(base: unknown, working: unknown): RecipeChange[] {
  const changes: RecipeChange[] = [];
  const walk = (a: unknown, b: unknown, path: string[]) => {
    if (typeof a === 'number' && typeof b === 'number') { if (a !== b) changes.push({ path: path.join('.'), from: a, to: b }); return; }
    if (Array.isArray(a) && Array.isArray(b) && a.length === b.length) { a.forEach((item, index) => walk(item, b[index], [...path, String(index)])); return; }
    if (isRecord(a) && isRecord(b) && !Array.isArray(a) && !Array.isArray(b)) {
      const keys = Object.keys(a);
      if (keys.length === Object.keys(b).length && keys.every(key => key in b && !key.includes('.'))) { for (const key of keys) walk(a[key], b[key], [...path, key]); return; }
    }
    if (JSON.stringify(a) !== JSON.stringify(b)) throw new TypeError(`The working copy changes ${path.join('.') || 'the recipe'} beyond its numbers; discard it.`);
  };
  walk(base, working, []);
  return changes;
}
function applyChanges(text: string, changes: readonly RecipeChange[]): string {
  return changes.reduce((next, change) => setRecipeNumber(next, change.path, change.to), text);
}

/** The working copy against the current tracked recipe. When the tracked recipe moved on since the copy began, the
 * copy is rebuilt as the new tracked text plus its own changes. A copy with no changes is removed. */
async function current(root: string, id: string): Promise<{ tracked: string; working: string | null; changes: RecipeChange[] }> {
  const tracked = await readText(trackedRecipePath(root, id));
  if (tracked === null) throw new TypeError(`src/objects/${id} has no source/recipe.json.`);
  const [working, base] = await Promise.all([readText(workingRecipePath(root, id)), readText(basePath(root, id))]);
  if (working === null) return { tracked, working: null, changes: [] };
  const changes = recipeChanges(JSON.parse(base ?? tracked), JSON.parse(working));
  if (!changes.length) { await clear(root, id); return { tracked, working: null, changes }; }
  if (base !== tracked) {
    const rebuilt = applyChanges(tracked, changes);
    await write(root, id, tracked, rebuilt);
    return { tracked, working: rebuilt, changes };
  }
  return { tracked, working, changes };
}
async function write(root: string, id: string, base: string, working: string) {
  await mkdir(labDirectory(root, id), { recursive: true });
  await writeFile(basePath(root, id), base);
  await writeFile(workingRecipePath(root, id), working);
}
async function clear(root: string, id: string) {
  await rm(workingRecipePath(root, id), { force: true });
  await rm(basePath(root, id), { force: true });
}

/** The recipe the lab shows and drafts: the working copy when there is one, else the tracked recipe. */
export async function readRecipeState(root: string, id: string): Promise<RecipeState> {
  const state = await current(root, id);
  return { recipe: JSON.parse(state.working ?? state.tracked), working: state.working !== null, changes: state.changes };
}
/** The recipe text a draft bakes. */
export async function workingRecipeText(root: string, id: string): Promise<string> {
  const state = await current(root, id);
  return state.working ?? state.tracked;
}
/** Sets numbers in the working copy (starting it from the tracked recipe). Only an existing number can be set. */
export async function editWorkingCopy(root: string, id: string, edits: readonly { path: string; value: number }[]): Promise<RecipeState> {
  const state = await current(root, id);
  const next = edits.reduce((text, edit) => setRecipeNumber(text, edit.path, edit.value), state.working ?? state.tracked);
  await write(root, id, state.tracked, next);
  return readRecipeState(root, id);
}
/** Writes the working copy's changes into the tracked recipe, number by number, and removes the working copy. */
export async function saveWorkingCopy(root: string, id: string): Promise<RecipeChange[]> {
  const state = await current(root, id);
  if (state.working === null) return [];
  await writeFile(trackedRecipePath(root, id), applyChanges(state.tracked, state.changes));
  await clear(root, id);
  return state.changes;
}
/** Drops the working copy. Returns the changes it held. */
export async function discardWorkingCopy(root: string, id: string): Promise<RecipeChange[]> {
  const state = await current(root, id);
  await clear(root, id);
  return state.changes;
}
/** `path=value` as the CLI takes it. */
export function readSetArgument(text: string): { path: string; value: number } {
  const match = /^([A-Za-z0-9]+(?:\.[A-Za-z0-9]+)*)=(.+)$/.exec(text);
  const value = match ? Number(match[2]) : NaN;
  if (!match || !Number.isFinite(value)) throw new TypeError(`Expected --set <path>=<number>; got ${JSON.stringify(text)}.`);
  return { path: match[1]!, value };
}
