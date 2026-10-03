export const PREPARED_SOURCES_SCHEMA = 'cssearth-prepared-sources@1';
import { parseSourceCatalog, parseSourceBinding, sourceResolver, sourceArray, sourceObject, sourceText, sourcePath, sourceUnique } from '../sources/catalog.js';
import { parseSourceUsage } from './source-usage.js';
import type { DatasetRoutes } from './dataset-routes.js';
export function parsePreparedSources(raw: unknown, routes: DatasetRoutes) {
  const value = sourceObject(raw,['schema','catalog','usage','inventory','closure']);
  if (value.schema !== PREPARED_SOURCES_SCHEMA) throw new TypeError('Unsupported prepared sources.');
  const catalog = parseSourceCatalog(value.catalog), sources = sourceResolver(catalog);
  const inventory = sourceArray(value.inventory, raw => {
    const entry = sourceObject(raw,['ownerPath','localId','binding','used']);
    if (typeof entry.used !== 'boolean') throw new TypeError('Invalid source inventory use.');
    return Object.freeze({ownerPath:sourcePath(entry.ownerPath),localId:sourceText(entry.localId),binding:parseSourceBinding(entry.binding,sources),used:entry.used});
  });
  sourceUnique(inventory.map(entry => `${entry.ownerPath}#${entry.localId}`),'inventory entry');
  const closure = Object.freeze([...sourceArray(value.closure, sourcePath)].sort());
  return Object.freeze({catalog,sources,inventory,usage:parseSourceUsage(value.usage,sources,routes),closure});
}
