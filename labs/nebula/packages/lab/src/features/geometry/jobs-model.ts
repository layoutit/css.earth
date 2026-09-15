/** Browser-safe contracts for explicit, non-destructive detector proposals. */
import { readDetectionSettings, type DetectionSettings } from '@cssearth/nebula-reconstruction/evidence/geometry/settings';

export interface DetectionRequest {
  action: 'apply'; cataloguePath: string; imageId: string; sourceSha256: string; mapSha256: string; settings: DetectionSettings;
  quality?: DetectionQuality;
}
export type DetectionQuality = 'draft' | 'detailed';
export function readDetectionQuality(value: unknown): DetectionQuality {
  if (value === undefined || value === 'detailed') return 'detailed';
  if (value === 'draft') return 'draft';
  throw new TypeError('Invalid detector preview quality.');
}
export interface DetectionResult {
  schema: 'cssearth-geometry-detection-result@1'; id: string; cataloguePath: string; imageId: string;
  sourceSha256: string; mapSha256: string; width: number; height: number; settings: DetectionSettings;
  geometry: { file: string; sha256: string };
  quality: DetectionQuality;
}
export const geometryRecord = (value: unknown): value is Record<string, unknown> => value !== null && typeof value === 'object' && !Array.isArray(value);
export const geometryHash = (value: unknown): value is string => typeof value === 'string' && /^[a-f0-9]{64}$/.test(value);
export const geometryFile = (value: unknown): value is string => typeof value === 'string' && /^geometry-[a-f0-9]{64}\.json$/.test(value);
export const geometryLocalPath = (value: unknown): value is string => typeof value === 'string' && value.startsWith('.local/nebula-lab/') &&
  !/[\\?#\u0000]/.test(value) && value.split('/').every(part => part !== '..' && part !== '.' && part.length > 0);
export function readDetectionRequest(value: unknown): DetectionRequest {
  if (!geometryRecord(value) || Object.keys(value).some(key => !['action', 'cataloguePath', 'imageId', 'sourceSha256', 'mapSha256', 'settings', 'quality'].includes(key)) ||
      value.action !== 'apply' || !geometryLocalPath(value.cataloguePath) || typeof value.imageId !== 'string' || !/^[a-z0-9-]+$/.test(value.imageId) ||
      !geometryHash(value.sourceSha256) || !geometryHash(value.mapSha256)) throw new TypeError('Choose a registered source and explicit detector settings.');
  return { action: 'apply', cataloguePath: value.cataloguePath, imageId: value.imageId, sourceSha256: value.sourceSha256,
    mapSha256: value.mapSha256, settings: readDetectionSettings(value.settings), quality: readDetectionQuality(value.quality) };
}
export function readDetectionResult(value: unknown): DetectionResult {
  if (!geometryRecord(value) || value.schema !== 'cssearth-geometry-detection-result@1' || !geometryHash(value.id) ||
      !geometryLocalPath(value.cataloguePath) || typeof value.imageId !== 'string' || !/^[a-z0-9-]+$/.test(value.imageId) ||
      !geometryHash(value.sourceSha256) || !geometryHash(value.mapSha256) ||
      typeof value.width !== 'number' || typeof value.height !== 'number' || !Number.isInteger(value.width) || !Number.isInteger(value.height) ||
      value.width < 32 || value.height < 32 || value.width * value.height > 1_000_000 || !geometryRecord(value.geometry) ||
      value.geometry.file !== `geometry-${value.id}.json` || !geometryHash(value.geometry.sha256)) throw new TypeError('Invalid detector proposal receipt.');
  return { schema: value.schema, id: value.id, cataloguePath: value.cataloguePath, imageId: value.imageId, sourceSha256: value.sourceSha256,
    mapSha256: value.mapSha256, width: value.width, height: value.height, settings: readDetectionSettings(value.settings),
    geometry: { file: `geometry-${value.id}.json`, sha256: value.geometry.sha256 }, quality: readDetectionQuality(value.quality) };
}
