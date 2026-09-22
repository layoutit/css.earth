import { readFile, writeFile } from 'node:fs/promises';

/** Preserve unchanged prepared files, including their watcher/mtime identity. */
export async function writePreparedText(path: string | URL, contents: string) {
  try { if (await readFile(path, 'utf8') === contents) return false; }
  catch (error) { if (!(error instanceof Error && 'code' in error && error.code === 'ENOENT')) throw error; }
  await writeFile(path, contents);
  return true;
}
