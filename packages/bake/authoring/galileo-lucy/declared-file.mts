import { readFile } from 'node:fs/promises';
import { basename, dirname } from 'node:path';
import { fetchWithRetry, publishPinnedSource } from '@cssearth/bake/objects/sources';

/** An evidence input its record names by path and origin: read it, restoring it from the origin first when it is
 * missing. Kernels and archive frames are not committed, so a fresh checkout restores them here. */
export async function readDeclaredFile(path: string, origin: string) {
  const existing = await readFile(path).catch(() => null);
  if (existing) return existing;
  const bytes = await fetchWithRetry(fetch, origin);
  await publishPinnedSource({ sourceRoot: dirname(path), entry: { path: basename(path), origin }, bytes });
  return bytes;
}
