/** Read-only archive discovery. An image candidate is not an accepted reconstruction input. */
export const archiveProviders = ['mast', 'irsa', 'eso'] as const;
export type ArchiveProvider = typeof archiveProviders[number];
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
export interface ArchiveImage {
  id: string; provider: ArchiveProvider; collection: string; title: string;
  instrument: string; facility: string; calibrationLevel: number;
  raDegrees: number | null; decDegrees: number | null; fieldDegrees: number | null;
  footprint: string | null; resolutionArcsec: number | null; width: number | null; height: number | null;
  wavelengthMinMeters: number | null; wavelengthMaxMeters: number | null; exposureSeconds: number | null;
  estimatedBytes: number | null; accessUrl: string | null; accessFormat: string | null;
  sourceUrl: string; previewUrl: string | null;
}
export interface ArchiveQuery {
  provider: ArchiveProvider; status: 'pending' | 'complete' | 'truncated' | 'error';
  queriedAt: string | null; endpoint: string; query: string; radiusDegrees: number;
  matchedCount: number | null; matchedEstimatedBytes: number | null; matchedUnknownSizeCount: number | null;
  images: ArchiveImage[]; error?: string; responseSha256?: string;
  imagesPath?: string; imagesSha256?: string; imageCount?: number;
}
export interface InventoryStorage {
  uniqueImages: number; estimatedBytes: number; unknownSizes: number;
  complete: number; truncated: number; errors: number; pending: number; isLowerBound: boolean;
}
export interface MessierInventory {
  schema: 'cssearth-messier-inventory@1'; generatedAt: string;
  catalogueSha256: string; policy: string; targets: { objectId: string; queries: ArchiveQuery[] }[]; storage?: InventoryStorage;
}
export function record(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
function text(value: unknown): value is string { return typeof value === 'string'; }
function finite(value: unknown): value is number { return typeof value === 'number' && Number.isFinite(value); }
function nullableNumber(value: unknown): boolean { return value === null || finite(value); }
function positiveOrNull(value: unknown): boolean { return value === null || (finite(value) && value > 0); }
function strings(value: unknown): value is string[] { return Array.isArray(value) && value.every(text); }
export function safeArchiveUrl(value: unknown): string | null {
  if (!text(value)) return null;
  try { const url = new URL(value); return ['https:', 'http:'].includes(url.protocol) && !url.username && !url.password ? url.href : null; }
  catch { return null; }
}
function nullableUrl(value: unknown): boolean { return value === null || safeArchiveUrl(value) !== null; }
function hash(value: unknown): boolean { return text(value) && /^[a-f0-9]{64}$/.test(value); }
function date(value: unknown): boolean { return text(value) && Number.isFinite(Date.parse(value)); }
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
export function readArchiveImage(value: unknown): ArchiveImage {
  if (!record(value) || !text(value.id) || !value.id || !archiveProviders.some(p => p === value.provider) ||
      !['collection', 'title', 'instrument', 'facility'].every(k => text(value[k])) || !finite(value.calibrationLevel) || value.calibrationLevel < 2 ||
      !['raDegrees', 'decDegrees'].every(k => nullableNumber(value[k])) ||
      !['fieldDegrees', 'resolutionArcsec', 'width', 'height', 'wavelengthMinMeters', 'wavelengthMaxMeters', 'exposureSeconds', 'estimatedBytes'].every(k => positiveOrNull(value[k])) ||
      !(value.footprint === null || text(value.footprint)) || !(value.accessFormat === null || text(value.accessFormat)) ||
      !nullableUrl(value.accessUrl) || !nullableUrl(value.previewUrl) || !safeArchiveUrl(value.sourceUrl)) throw new TypeError('Invalid archive image metadata.');
  return value as unknown as ArchiveImage;
}
export function readArchiveQuery(value: unknown): ArchiveQuery {
  if (!record(value) || !archiveProviders.some(p => p === value.provider) ||
      !['pending', 'complete', 'truncated', 'error'].includes(String(value.status)) || !(value.queriedAt === null || date(value.queriedAt)) ||
      !safeArchiveUrl(value.endpoint) || !text(value.query) || !finite(value.radiusDegrees) || value.radiusDegrees <= 0 || value.radiusDegrees > 180 ||
      !['matchedCount', 'matchedEstimatedBytes', 'matchedUnknownSizeCount'].every(k => value[k] === null || (finite(value[k]) && value[k] >= 0)) ||
      !Array.isArray(value.images) || (value.error !== undefined && !text(value.error)) ||
      (value.responseSha256 !== undefined && !hash(value.responseSha256))) throw new TypeError('Invalid archive query receipt.');
  const ids = new Set<string>();
  for (const image of value.images) { const parsed = readArchiveImage(image);
    if (parsed.provider !== value.provider || ids.has(parsed.id)) throw new TypeError('Invalid image ownership or duplicate archive record.'); ids.add(parsed.id); }
  if (value.imagesPath !== undefined && (!text(value.imagesPath) || !/^\.local\/nebula-lab\/catalogue\/messier\/queries\/m\d+-(mast|irsa|eso)\.json$/.test(value.imagesPath) ||
      !hash(value.imagesSha256) || !finite(value.imageCount) || !Number.isInteger(value.imageCount) || value.imageCount < 0)) throw new TypeError('Invalid archive page reference.');
  if (value.imagesPath === undefined && (value.imagesSha256 !== undefined || value.imageCount !== undefined)) throw new TypeError('Incomplete archive page reference.');
  if (value.status === 'complete' && (value.matchedCount !== (value.imageCount ?? value.images.length) || value.queriedAt === null)) throw new TypeError('Incomplete archive result marked complete.');
  if (value.status === 'error' && !value.error) throw new TypeError('Archive failure reason is missing.');
  return value as unknown as ArchiveQuery;
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
