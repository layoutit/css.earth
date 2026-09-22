/** Pinned local bake inputs. No acquisition, repository models, jobs or application path rewriting. */
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { isAbsolute, relative, resolve } from 'node:path';
export interface Pin { path: string }
export const hash = (bytes: Uint8Array | string) => createHash('sha256').update(bytes).digest('hex');
export function localPath(root: string, path: string) {
  const full = resolve(root, path), offset = relative(root, full);
  if (isAbsolute(path) || !offset || offset === '..' || offset.startsWith('../')) throw new Error(`Invalid recipe path: ${path}`);
  return full;
}
export async function pinned(root: string, pin: Pin) {
  const bytes = await readFile(localPath(root, pin.path));
  return bytes;
}
