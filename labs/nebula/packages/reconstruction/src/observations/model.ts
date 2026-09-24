import { isRecord as record } from '@cssearth/core';
/** Read-only archive discovery. An image candidate is not an accepted reconstruction input. */
export const archiveProviders = ['mast', 'irsa', 'eso'] as const;
export type ArchiveProvider = typeof archiveProviders[number];
export interface ArchiveTarget { raDegrees: number; decDegrees: number; majorArcmin: number | null; }
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
const safePagePath = (path: string) => !path.startsWith('/') && !/[\\:?#]/.test(path) && path.split('/').every(part => part && part !== '.' && part !== '..');
export function readArchiveImage(value: unknown): ArchiveImage {
  if (!record(value) || !text(value.id) || !value.id || !archiveProviders.some(p => p === value.provider) ||
      !['collection', 'title', 'instrument', 'facility'].every(k => text(value[k])) || !finite(value.calibrationLevel) || value.calibrationLevel < 2 ||
      !['raDegrees', 'decDegrees'].every(k => nullableNumber(value[k])) ||
      !['fieldDegrees', 'resolutionArcsec', 'width', 'height', 'wavelengthMinMeters', 'wavelengthMaxMeters', 'exposureSeconds', 'estimatedBytes'].every(k => positiveOrNull(value[k])) ||
      !(value.footprint === null || text(value.footprint)) || !(value.accessFormat === null || text(value.accessFormat)) ||
      !nullableUrl(value.accessUrl) || !nullableUrl(value.previewUrl) || !safeArchiveUrl(value.sourceUrl)) throw new TypeError('Invalid archive image metadata.');
  return value as unknown as ArchiveImage;
}
export function readArchiveQuery(value: unknown, allowedPagePath: (path: string) => boolean = safePagePath): ArchiveQuery {
  if (!record(value) || !archiveProviders.some(p => p === value.provider) ||
      !['pending', 'complete', 'truncated', 'error'].includes(String(value.status)) || !(value.queriedAt === null || date(value.queriedAt)) ||
      !safeArchiveUrl(value.endpoint) || !text(value.query) || !finite(value.radiusDegrees) || value.radiusDegrees <= 0 || value.radiusDegrees > 180 ||
      !['matchedCount', 'matchedEstimatedBytes', 'matchedUnknownSizeCount'].every(k => value[k] === null || (finite(value[k]) && value[k] >= 0)) ||
      !Array.isArray(value.images) || (value.error !== undefined && !text(value.error)) ||
      (value.responseSha256 !== undefined && !hash(value.responseSha256))) throw new TypeError('Invalid archive query receipt.');
  const ids = new Set<string>();
  for (const image of value.images) { const parsed = readArchiveImage(image);
    if (parsed.provider !== value.provider || ids.has(parsed.id)) throw new TypeError('Invalid image ownership or duplicate archive record.'); ids.add(parsed.id); }
  if (value.imagesPath !== undefined && (!text(value.imagesPath) || !allowedPagePath(value.imagesPath) ||
      !hash(value.imagesSha256) || !finite(value.imageCount) || !Number.isInteger(value.imageCount) || value.imageCount < 0)) throw new TypeError('Invalid archive page reference.');
  if (value.imagesPath === undefined && (value.imagesSha256 !== undefined || value.imageCount !== undefined)) throw new TypeError('Incomplete archive page reference.');
  if (value.status === 'complete' && (value.matchedCount !== (value.imageCount ?? value.images.length) || value.queriedAt === null)) throw new TypeError('Incomplete archive result marked complete.');
  if (value.status === 'error' && !value.error) throw new TypeError('Archive failure reason is missing.');
  return value as unknown as ArchiveQuery;
}
