import { readFile, readdir } from 'node:fs/promises';
import { resolve } from 'node:path';
import { parseSourceCatalog } from '../../src/platform/source-catalog.mts';

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
