import { parseSourceCatalog, parseSourceBinding, sourceResolver, sourceArray, sourceObject, sourceText, sourcePath, sourceUnique } from './source-catalog.mts';
import { parseSourceUsage } from './source-usage.mts';
export function parsePreparedSources(raw: unknown) {
  const value = sourceObject(raw,['schema','catalog','usage','inventory','closure']);
  if (value.schema !== 'cssearth-prepared-sources@1') throw new TypeError('Unsupported prepared sources.');
  const catalog = parseSourceCatalog(value.catalog), sources = sourceResolver(catalog);
  const inventory = sourceArray(value.inventory, raw => {
    const entry = sourceObject(raw,['ownerPath','localId','binding','used']);
    if (typeof entry.used !== 'boolean') throw new TypeError('Invalid source inventory use.');
    return Object.freeze({ownerPath:sourcePath(entry.ownerPath),localId:sourceText(entry.localId),binding:parseSourceBinding(entry.binding,sources),used:entry.used});
  });
  sourceUnique(inventory.map(entry => `${entry.ownerPath}#${entry.localId}`),'inventory entry');
  const closure = Object.freeze([...sourceArray(value.closure, sourcePath)].sort());
  return Object.freeze({catalog,sources,inventory,usage:parseSourceUsage(value.usage,sources),closure});
}
