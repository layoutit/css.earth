/** Memory between explorations. Every archive answer `explore` gets is already saved under `output/telescopes/` as evidence;
 * for a day, the same question is answered from that file and the archive is not asked again. `telescope explore --fresh`
 * asks every archive anew. An answer is recalled only for the same question, word for word. */
import { readdir, readFile, stat } from 'node:fs/promises';
import { resolve } from 'node:path';
import { hasErrorCode } from '@cssearth/core';

export const ARCHIVE_MEMORY_MS = 24 * 60 * 60 * 1000;
/** `--fresh` reaches every search through the environment, as the command's terminal state does. */
export const FRESH_VARIABLE = 'CSSEARTH_TELESCOPE_FRESH';
export const archiveMemoryMs = (): number => process.env[FRESH_VARIABLE] ? 0 : ARCHIVE_MEMORY_MS;

/** Each saved file is read once in a process; one exploration asks the same folder dozens of times. */
const read = new Map<string, Promise<unknown>>();
const parsed = (path: string) => { let value = read.get(path); if (!value) { value = readFile(path, 'utf8').then(text => JSON.parse(text) as unknown); read.set(path, value); } return value; };

/** From the newest file of `directory` ending in `suffix` and saved within the memory, whatever `pick` makes of it; the next
 * newest when `pick` returns nothing. Nothing when the memory is off or the folder does not exist. */
export async function recall<T>(directory: string, suffix: string, pick: (value: unknown, name: string) => T | undefined, now = Date.now()): Promise<T | undefined> {
  const within = archiveMemoryMs();
  if (!within) return undefined;
  const names = await readdir(directory).catch(error => { if (hasErrorCode(error, 'ENOENT')) return [] as string[]; throw error; });
  const dated = (await Promise.all(names.filter(name => name.endsWith(suffix)).map(async name => ({ name, saved: (await stat(resolve(directory, name)).catch(() => undefined))?.mtimeMs ?? 0 }))))
    .filter(file => now - file.saved <= within).sort((a, b) => b.saved - a.saved);
  for (const file of dated) {
    const found = pick(await parsed(resolve(directory, file.name)).catch(() => undefined), file.name);
    if (found !== undefined) return found;
  }
  return undefined;
}
