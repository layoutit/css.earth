import { readFile, readdir } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { resolve } from 'node:path';
import { parseSourceCatalog } from '../src/platform/source-catalog.mts';
import { sourceCatalogDigest } from '../src/platform/prepared-sources.mts';

async function sourceRecordPaths(root: string): Promise<string[]> {
  const entries = await readdir(resolve(root, 'src/sources'), { withFileTypes: true });
  return entries.filter(entry => entry.isFile() && entry.name.endsWith('.json'))
    .map(entry => `src/sources/${entry.name}`).sort();
}

/** Read independent source records; the catalogue schema still owns validation. */
export async function readSourceCatalog(root: string, input = (path: string) => readFile(resolve(root, path))) {
  const paths = await sourceRecordPaths(root);
  if (!paths.length) throw new TypeError('No source records in src/sources.');
  const records: unknown[] = [];
  // The input callback also records byte pins; keep their insertion order stable.
  for (const path of paths) records.push(JSON.parse((await input(path)).toString('utf8')));
  const catalog = parseSourceCatalog({ schema: 'cssearth-source-catalog@1', records });
  for (const [index, record] of catalog.records.entries()) {
    if (paths[index] !== `src/sources/${record.id}.json`) throw new TypeError(`Source identity differs from filename: ${paths[index]}.`);
  }
  return catalog;
}

/** Check current files as well as the catalogue compiled from them. */
export async function checkSourceCatalog(root: string, prepared: {
  readonly catalogSha256: string; readonly closure: Readonly<Record<string, string>>;
}) {
  const input = async (path: string) => {
    const bytes = await readFile(resolve(root, path));
    if (createHash('sha256').update(bytes).digest('hex') !== prepared.closure[path]) {
      throw new Error(`Stale sources catalogue: ${path}. Run pnpm prepare:sources.`);
    }
    return bytes;
  };
  // New files have no pin; removed or changed records alter the catalogue digest.
  if (sourceCatalogDigest(await readSourceCatalog(root, input)) !== prepared.catalogSha256) {
    throw new Error('Source catalogue differs from its records. Run pnpm prepare:sources.');
  }
  for (const path of Object.keys(prepared.closure)) if (!path.startsWith('src/sources/')) await input(path);
}
