import { isRecord as coreIsRecord } from '@cssearth/core';
import { readShapeCloudSettings } from './model.ts';
import { readShapeCloudQuality } from './quality.ts';
import { readShapeCloudComparison } from './comparison-result.ts';
import type { ShapeCloudPin, ShapeCloudResult } from './types.ts';
import { isVariantName } from '../variant-name.ts';
import { geometryFile } from '../geometry/jobs-model.ts';
const record = coreIsRecord;
export function readShapeCloudPin(value: unknown): ShapeCloudPin {
  if (!record(value) || typeof value.path !== 'string' || !value.path.startsWith('.local/nebula-lab/') || /[\\?#\u0000]/.test(value.path) ||
      value.path.split('/').some(part => part === '..' || part === '.' || !part) || Object.keys(value).join() !== 'path')
    throw new TypeError(`Invalid shape-cloud resource reference: ${JSON.stringify(value)}`);
  return { path: value.path };
}
export function readShapeCloudResult(value: unknown): ShapeCloudResult {
  if (!record(value) || value.schema !== 'cssearth-shape-cloud-result@1' || !isVariantName(value.id) || typeof value.imageId !== 'string' || !/^[a-z0-9-]+$/.test(value.imageId) ||
      !geometryFile(value.geometryFile) || typeof value.width !== 'number' || typeof value.height !== 'number' ||
      !Number.isInteger(value.width) || !Number.isInteger(value.height) || value.width < 32 || value.height < 32 || value.width * value.height > 1_000_000 ||
      typeof value.unitsPerPixel !== 'number' || !Number.isFinite(value.unitsPerPixel) || Math.abs(value.unitsPerPixel - 10 / value.width) > 1e-12 || typeof value.empty !== 'boolean')
    throw new TypeError('Invalid prepared shape-cloud result.');
  const settings = readShapeCloudSettings(value.settings, value.width, value.height);
  if (value.preparationVersion !== undefined && (typeof value.preparationVersion !== 'string' || !/^[a-z0-9-]+@\d+$/.test(value.preparationVersion)))
    throw new TypeError('Invalid shape-cloud preparation version.');
  const neutral = value.neutral === undefined ? undefined : readShapeCloudPin(value.neutral);
  const textured = value.textured === undefined ? undefined : readShapeCloudPin(value.textured);
  if (value.empty ? neutral || textured : !neutral || !textured) throw new TypeError('Incomplete shape-cloud materials.');
  return { schema: value.schema, id: value.id, imageId: value.imageId, geometryFile: value.geometryFile, width: value.width, height: value.height,
    unitsPerPixel: value.unitsPerPixel, settings, empty: value.empty, quality: readShapeCloudQuality(value.quality), preparationVersion: value.preparationVersion, source: readShapeCloudPin(value.source),
    ...(neutral ? { neutral } : {}), ...(textured ? { textured } : {}),
    ...(value.comparison === undefined ? {} : { comparison: readShapeCloudComparison(value.comparison, value.width, value.height, readShapeCloudPin) }),
    ...(value.projection === undefined ? {} : { projection: readShapeCloudPin(value.projection) }) };
}
