/** Pinned local bake inputs. No acquisition, repository models, jobs or application path rewriting. */
import { containedPath } from '@cssearth/core/node';
import { mkdir, readFile, rename, rm, writeFile } from 'node:fs/promises';
import { dirname, isAbsolute, join, resolve } from 'node:path';
import type { CompilerPin } from '@cssearth/objects';
export type { CompilerPin } from '@cssearth/objects';
/** Where a download of `url` is kept in a throwaway local cache: the escaped URL itself, cut into directory names short
 * enough for any file system. The caller creates the parent directory. */
export function urlCachePath(directory: string, url: string, extension: string): string {
  const parts = encodeURIComponent(url).match(/.{1,200}/gu) ?? ['_'];
  return join(directory, ...parts) + extension;
}
export function localPath(root: string, path: string) {
  const full = resolve(root, path);
  if (isAbsolute(path) || containedPath(root, full, { policy: 'lexical', rootPath: 'reject',
    parentSeparator: 'posix', absoluteOffset: 'allow' }) === undefined) throw new Error(`Invalid recipe path: ${path}`);
  return full;
}
export async function pinned(root: string, pin: CompilerPin) {
  const bytes = await readFile(localPath(root, pin.path));
  return bytes;
}

/** Compact source pins resolve symlinks and must remain within their real root. */
export async function readCompactPin(root: string, p: CompilerPin) {
  if (p.path.startsWith("/") || p.path.split("/").includes(".."))
    throw new Error("Invalid compact source path");
  const actual = await containedPath(root, resolve(root, p.path), { policy: 'realpath', rootPath: 'allow',
    parentSeparator: 'posix', absoluteOffset: 'reject' });
  if (actual === undefined) throw new Error("Compact pin escapes root");
  return readFile(actual);
}

export async function writeAtomic(path: string, bytes: Uint8Array | string) {
  await mkdir(dirname(path), { recursive: true });
  const temporary = `${path}.${process.pid}.tmp`;
  try { await writeFile(temporary, bytes); await rename(temporary, path); }
  finally { await rm(temporary, { force: true }); }
}
