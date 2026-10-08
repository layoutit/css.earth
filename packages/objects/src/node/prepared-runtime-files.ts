/**
 * How a prepared runtime is stored under `prepared/`.
 *
 * A sphere's runtime carries one list of leaf boxes, and every sphere of a profile carries the same list: 32 distinct
 * lists over 3,925 bodies, 683 of the 1,090 MB of runtimes (2026-10-08). Inline, the list is hosted once a body. In a
 * file of its own it has one content address a profile. So the stored `runtime.json` names `leaf-boxes.json` where the
 * list stood, and whoever needs the whole runtime reads it with `readPreparedRuntimeText`: the text the bake wrote,
 * byte for byte. A stored runtime read without it fails validation, since a file name is not a list of boxes.
 */
import { readFile, rm, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { isRecord } from '@cssearth/core';

/** The file a stored runtime keeps its leaf boxes in, beside `runtime.json`. */
export const LEAF_BOXES_FILE = 'leaf-boxes.json';
const reference = `"boxes":{"file":"${LEAF_BOXES_FILE}"}`;

/** A runtime's text with its list of leaf boxes taken out, and the list. `null` when the runtime carries no list, or
 * not exactly one, and stays as it is. */
export function splitPreparedRuntimeText(text: string): { runtime: string; leafBoxes: string } | null {
  if (!text.includes('"boxes":[')) return null;
  const document: unknown = JSON.parse(text);
  const bindings: unknown[] = isRecord(document) && Array.isArray(document.viewBindings) ? document.viewBindings : [];
  const lists = bindings.flatMap(binding => isRecord(binding) && Array.isArray(binding.boxes) ? [JSON.stringify(binding.boxes)] : []);
  if (lists.length !== 1) return null;
  const inline = `"boxes":${lists[0]}`, at = text.indexOf(inline);
  if (at < 0 || text.includes(inline, at + 1) || text.includes(reference)) return null;
  return { runtime: text.slice(0, at) + reference + text.slice(at + inline.length), leafBoxes: `${lists[0]}\n` };
}

/** The runtime text as its bake wrote it: `runtime` itself, or with the leaf boxes it names put back. */
export async function joinPreparedRuntimeText(runtime: string, leafBoxes: () => string | Promise<string>): Promise<string> {
  const at = runtime.indexOf(reference);
  return at < 0 ? runtime : `${runtime.slice(0, at)}"boxes":${(await leafBoxes()).trimEnd()}${runtime.slice(at + reference.length)}`;
}

/** The whole runtime of the body whose `prepared/` directory this is. */
export async function readPreparedRuntimeText(preparedDirectory: string): Promise<string> {
  return joinPreparedRuntimeText(await readFile(resolve(preparedDirectory, 'runtime.json'), 'utf8'),
    () => readFile(resolve(preparedDirectory, LEAF_BOXES_FILE), 'utf8'));
}

/** Put a baked runtime in its stored form, before it is inventoried. A directory without a runtime is left alone. */
export async function storePreparedRuntime(preparedDirectory: string): Promise<void> {
  const path = resolve(preparedDirectory, 'runtime.json');
  const text = await readFile(path, 'utf8').catch((error: unknown) => {
    if (error instanceof Error && 'code' in error && error.code === 'ENOENT') return null;
    throw error;
  });
  if (text === null || text.includes(reference)) return;
  const split = splitPreparedRuntimeText(text);
  // A rebake that no longer carries a list leaves no file of an earlier one.
  if (!split) { await rm(resolve(preparedDirectory, LEAF_BOXES_FILE), { force: true }); return; }
  await writeFile(resolve(preparedDirectory, LEAF_BOXES_FILE), split.leafBoxes);
  await writeFile(path, split.runtime);
}
