/** Pinned local bake inputs. No acquisition, repository models, jobs or application path rewriting. */
import { createHash } from 'node:crypto';
import { mkdir, readFile, realpath, rename, rm, writeFile } from 'node:fs/promises';
import { dirname, isAbsolute, relative, resolve } from 'node:path';
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

/** Compact source pins resolve symlinks and must remain within their real root. */
export async function readCompactPin(root: string, p: Pin) {
  if (p.path.startsWith("/") || p.path.split("/").includes(".."))
    throw new Error("Invalid compact source path");
  const actual = await realpath(resolve(root, p.path));
  const offset = relative(await realpath(root), actual);
  if (offset === ".." || offset.startsWith("../") || isAbsolute(offset)) throw new Error("Compact pin escapes root");
  return readFile(actual);
}

export async function writeAtomic(path: string, bytes: Uint8Array | string) {
  await mkdir(dirname(path), { recursive: true });
  const temporary = `${path}.${process.pid}.tmp`;
  try { await writeFile(temporary, bytes); await rename(temporary, path); }
  finally { await rm(temporary, { force: true }); }
}
