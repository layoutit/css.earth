import { readShapeCloudSettings } from './model.ts';
import { readShapeCloudQuality } from './quality.ts';
import { readShapeCloudComparison } from './comparison-result.ts';
import type { ShapeCloudPin, ShapeCloudResult } from './types.ts';
const record = (value: unknown): value is Record<string, unknown> => value !== null && typeof value === 'object' && !Array.isArray(value);
const hash = (value: unknown): value is string => typeof value === 'string' && /^[a-f0-9]{64}$/.test(value);
export function readShapeCloudPin(value: unknown): ShapeCloudPin {
  if (!record(value) || typeof value.path !== 'string' || !value.path.startsWith('.local/nebula-lab/') || /[\\?#\u0000]/.test(value.path) ||
      value.path.split('/').some(part => part === '..' || part === '.' || !part) || !hash(value.sha256)) throw new TypeError('Invalid shape-cloud resource pin.');
  return { path: value.path, sha256: value.sha256 };
}
export function readShapeCloudResult(value: unknown): ShapeCloudResult {
  if (!record(value) || value.schema !== 'cssearth-shape-cloud-result@1' || !hash(value.id) || typeof value.imageId !== 'string' || !/^[a-z0-9-]+$/.test(value.imageId) ||
      !hash(value.sourceSha256) || !hash(value.mapSha256) || !hash(value.geometrySha256) || typeof value.width !== 'number' || typeof value.height !== 'number' ||
      !Number.isInteger(value.width) || !Number.isInteger(value.height) || value.width < 32 || value.height < 32 || value.width * value.height > 1_000_000 ||
      typeof value.unitsPerPixel !== 'number' || !Number.isFinite(value.unitsPerPixel) || Math.abs(value.unitsPerPixel - 10 / value.width) > 1e-12 || typeof value.empty !== 'boolean')
    throw new TypeError('Invalid prepared shape-cloud result.');
  const settings = readShapeCloudSettings(value.settings, value.width, value.height);
  if (value.preparationVersion !== undefined && (typeof value.preparationVersion !== 'string' || !/^[a-z0-9-]+@\d+$/.test(value.preparationVersion)))
    throw new TypeError('Invalid shape-cloud preparation version.');
  const neutral = value.neutral === undefined ? undefined : readShapeCloudPin(value.neutral);
  const textured = value.textured === undefined ? undefined : readShapeCloudPin(value.textured);
  if (value.empty ? neutral || textured : !neutral || !textured) throw new TypeError('Incomplete shape-cloud materials.');
  return { schema: value.schema, id: value.id, imageId: value.imageId, sourceSha256: value.sourceSha256,
    mapSha256: value.mapSha256, geometrySha256: value.geometrySha256, width: value.width, height: value.height,
    unitsPerPixel: value.unitsPerPixel, settings, empty: value.empty, quality: readShapeCloudQuality(value.quality), preparationVersion: value.preparationVersion, source: readShapeCloudPin(value.source),
    ...(neutral ? { neutral } : {}), ...(textured ? { textured } : {}),
    ...(value.comparison === undefined ? {} : { comparison: readShapeCloudComparison(value.comparison, value.width, value.height, readShapeCloudPin) }),
    ...(value.projection === undefined ? {} : { projection: readShapeCloudPin(value.projection) }) };
}
