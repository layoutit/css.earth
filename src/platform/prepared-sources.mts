import { createHash } from 'node:crypto';
import { parseSourceCatalog, parseSourceBinding, sourceResolver, sourceArray, sourceObject, sourceText, sourceDigest, sourcePath, sourceUnique } from './source-catalog.mts';
import type { SourceCatalog } from './source-catalog.mts';
import { parseSourceUsage } from './source-usage.mts';
export const sourceCatalogDigest = (catalog: SourceCatalog) => createHash('sha256').update(JSON.stringify(catalog)).digest('hex');
export function parsePreparedSources(raw: unknown) {
  const value = sourceObject(raw,['schema','catalog','catalogSha256','usage','inventory','closure']);
  if (value.schema !== 'cssearth-prepared-sources@1') throw new TypeError('Unsupported prepared sources.');
  const catalog = parseSourceCatalog(value.catalog), sources = sourceResolver(catalog);
  const inventory = sourceArray(value.inventory, raw => {
    const entry = sourceObject(raw,['ownerPath','localId','binding','used']);
    if (typeof entry.used !== 'boolean') throw new TypeError('Invalid source inventory use.');
    return Object.freeze({ownerPath:sourcePath(entry.ownerPath),localId:sourceText(entry.localId),binding:parseSourceBinding(entry.binding,sources),used:entry.used});
  });
  sourceUnique(inventory.map(entry => `${entry.ownerPath}#${entry.localId}`),'inventory entry');
  const closure = Object.freeze(Object.fromEntries(Object.entries(sourceObject(value.closure)).map(([path,digest]) => [sourcePath(path),sourceDigest(digest)])));
  const catalogSha256 = sourceDigest(value.catalogSha256);
  const paths = catalog.records.map(record => `src/sources/${record.id}.json`).sort();
  const pinned = Object.keys(closure).filter(path => path.startsWith('src/sources/')).sort();
  if (catalogSha256 !== sourceCatalogDigest(catalog) || JSON.stringify(paths) !== JSON.stringify(pinned)) throw new TypeError('Source catalogue closure mismatch.');
  return Object.freeze({catalog,catalogSha256,sources,inventory,usage:parseSourceUsage(value.usage,sources),closure});
}
