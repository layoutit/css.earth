import { readFile } from 'node:fs/promises';

/** External source data stays unknown until its consumer checks the needed fields with `@cssearth/core`. */
export async function readJsonSource(path: string | URL): Promise<unknown> {
  return JSON.parse(await readFile(path, 'utf8'));
}
