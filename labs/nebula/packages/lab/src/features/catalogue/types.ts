export * from '@cssearth/nebula-reconstruction/observations/model';
import {isRecord as record} from '@cssearth/core';
import {safeArchiveUrl,readArchiveQuery as readQuery,type ArchiveQuery} from '@cssearth/nebula-reconstruction/observations/model';
export interface MessierObject {
  id: string; messier: number; name: string; aliases: string[]; type: string;
  raDegrees: number; decDegrees: number; majorArcmin: number | null; minorArcmin: number | null;
  sourceIds: string[]; notes?: string;
}
export interface MessierCatalogue {
  schema: 'cssearth-messier-catalogue@1';
  sources: { id: string; url: string; credit: string; retrievedAt?: string; sha256?: string }[];
  objects: MessierObject[];
}
export interface InventoryStorage {
  uniqueImages: number; estimatedBytes: number; unknownSizes: number;
  complete: number; truncated: number; errors: number; pending: number; isLowerBound: boolean;
}
export interface MessierInventory {
  schema: 'cssearth-messier-inventory@1'; generatedAt: string;
  catalogueSha256: string; policy: string; targets: { objectId: string; queries: ArchiveQuery[] }[]; storage?: InventoryStorage;
}
function text(value: unknown): value is string { return typeof value === 'string'; }
function finite(value: unknown): value is number { return typeof value === 'number' && Number.isFinite(value); }
function nullableNumber(value: unknown): boolean { return value === null || finite(value); }
function positiveOrNull(value: unknown): boolean { return value === null || (finite(value) && value > 0); }
function strings(value: unknown): value is string[] { return Array.isArray(value) && value.every(text); }
function hash(value: unknown): boolean { return text(value) && /^[a-f0-9]{64}$/.test(value); }
function date(value: unknown): boolean { return text(value) && Number.isFinite(Date.parse(value)); }
export function readArchiveQuery(value: unknown): ArchiveQuery { return readQuery(value,path=>/^\.local\/nebula-lab\/catalogue\/messier\/queries\/m\d+-(mast|irsa|eso)\.json$/.test(path)); }
export function readMessierCatalogue(value: unknown): MessierCatalogue {
  if (!record(value) || value.schema !== 'cssearth-messier-catalogue@1' || !Array.isArray(value.sources) || !value.sources.length ||
      !value.sources.every(s => record(s) && text(s.id) && safeArchiveUrl(s.url) && text(s.credit)) || !Array.isArray(value.objects) || value.objects.length !== 110) {
    throw new TypeError('Invalid Messier catalogue.');
  }
  const sourceIds = new Set(value.sources.map(s => s.id)), ids = new Set<string>();
  for (const o of value.objects) {
    if (!record(o) || !Number.isInteger(o.messier) || !finite(o.messier) || o.messier < 1 || o.messier > 110 || o.id !== `m${o.messier}` ||
        !text(o.id) || ids.has(o.id) || !text(o.name) || !text(o.type) || !strings(o.aliases) ||
        !finite(o.raDegrees) || o.raDegrees < 0 || o.raDegrees >= 360 || !finite(o.decDegrees) || Math.abs(o.decDegrees) > 90 ||
        !positiveOrNull(o.majorArcmin) || !positiveOrNull(o.minorArcmin) || !strings(o.sourceIds) || !o.sourceIds.length ||
        o.sourceIds.some(id => !sourceIds.has(id)) || (o.notes !== undefined && !text(o.notes))) throw new TypeError('Invalid or duplicate Messier object.');
    ids.add(o.id);
  }
  return value as unknown as MessierCatalogue;
}
export function readMessierInventory(value: unknown): MessierInventory {
  if (!record(value) || value.schema !== 'cssearth-messier-inventory@1' || !date(value.generatedAt) || !hash(value.catalogueSha256) ||
      !text(value.policy) || !Array.isArray(value.targets) || value.targets.length !== 110) throw new TypeError('Invalid Messier inventory.');
  const ids = new Set<string>();
  const storage = value.storage;
  if (storage !== undefined && (!record(storage) ||
      !['uniqueImages', 'estimatedBytes', 'unknownSizes', 'complete', 'truncated', 'errors', 'pending'].every(k => finite(storage[k]) && storage[k] >= 0) ||
      typeof storage.isLowerBound !== 'boolean')) throw new TypeError('Invalid inventory size summary.');
  for (const target of value.targets) {
    if (!record(target) || !text(target.objectId) || !/^m([1-9]|[1-9][0-9]|10[0-9]|110)$/.test(target.objectId) || ids.has(target.objectId) ||
        !Array.isArray(target.queries) || target.queries.length !== 3) throw new TypeError('Invalid Messier inventory target.');
    ids.add(target.objectId); const providers = target.queries.map(q => readArchiveQuery(q).provider);
    if (new Set(providers).size !== 3) throw new TypeError('Missing or duplicate archive query.');
    for (const query of target.queries) if (query.imagesPath && query.imagesPath !== `.local/nebula-lab/catalogue/messier/queries/${target.objectId}-${query.provider}.json`) throw new TypeError('Archive page belongs to another object.');
  }
  if (value.targets.some(target => target.queries.some((q: ArchiveQuery) => q.imagesPath)) && !storage) throw new TypeError('Compact inventory size summary is missing.');
  return value as unknown as MessierInventory;
}
