/** Browser-safe contracts for explicit, non-destructive detector proposals. */
import { readDetectionSettings, type DetectionSettings } from '@cssearth/nebula-reconstruction/evidence/geometry/settings';
import { isVariantName } from '../variant-name.ts';

export interface DetectionRequest {
  action: 'apply'; cataloguePath: string; imageId: string; settings: DetectionSettings;
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
  /** The structure analysis run the geometry was detected in. */
  mapDirectory: string; width: number; height: number; settings: DetectionSettings;
  geometry: { file: string };
  quality: DetectionQuality;
}
export const geometryRecord = (value: unknown): value is Record<string, unknown> => value !== null && typeof value === 'object' && !Array.isArray(value);
/** `geometry.json` is the prepared attachment of an analysis run; `geometry-<variant>.json` one detector proposal. */
export const geometryFile = (value: unknown): value is string => typeof value === 'string' &&
  (value === 'geometry.json' || (value.startsWith('geometry-') && value.endsWith('.json') && isVariantName(value.slice(9, -5))));
export const geometryLocalPath = (value: unknown): value is string => typeof value === 'string' && value.startsWith('.local/nebula-lab/') &&
  !/[\\?#\u0000]/.test(value) && value.split('/').every(part => part !== '..' && part !== '.' && part.length > 0);
export function readDetectionRequest(value: unknown): DetectionRequest {
  if (!geometryRecord(value) || Object.keys(value).some(key => !['action', 'cataloguePath', 'imageId', 'settings', 'quality'].includes(key)) ||
      value.action !== 'apply' || !geometryLocalPath(value.cataloguePath) || typeof value.imageId !== 'string' || !/^[a-z0-9-]+$/.test(value.imageId))
    throw new TypeError('Choose a registered source and explicit detector settings.');
  return { action: 'apply', cataloguePath: value.cataloguePath, imageId: value.imageId,
    settings: readDetectionSettings(value.settings), quality: readDetectionQuality(value.quality) };
}
export function readDetectionResult(value: unknown): DetectionResult {
  if (!geometryRecord(value) || value.schema !== 'cssearth-geometry-detection-result@1' || !isVariantName(value.id) ||
      !geometryLocalPath(value.cataloguePath) || typeof value.imageId !== 'string' || !/^[a-z0-9-]+$/.test(value.imageId) ||
      typeof value.mapDirectory !== 'string' || !geometryLocalPath(value.mapDirectory) ||
      typeof value.width !== 'number' || typeof value.height !== 'number' || !Number.isInteger(value.width) || !Number.isInteger(value.height) ||
      value.width < 32 || value.height < 32 || value.width * value.height > 1_000_000 || !geometryRecord(value.geometry) ||
      value.geometry.file !== `geometry-${value.id}.json` || Object.keys(value.geometry).join() !== 'file') throw new TypeError('Invalid detector proposal receipt.');
  return { schema: value.schema, id: value.id, cataloguePath: value.cataloguePath, imageId: value.imageId, mapDirectory: value.mapDirectory,
    width: value.width, height: value.height, settings: readDetectionSettings(value.settings),
    geometry: { file: `geometry-${value.id}.json` }, quality: readDetectionQuality(value.quality) };
}
