/** The receipt a plate bake returns as its job result (and leaves beside a draft). */
import { isRecord } from '@cssearth/core';
import { plateObjectId, platesDirectory, type PlateQuality } from './plates-paths.ts';

export const PLATE_BAKE_SCHEMA = 'cssearth-lab-plate-bake@3';
export interface PlateBakeReceipt {
  schema: typeof PLATE_BAKE_SCHEMA; object: string; quality: PlateQuality; directory: string;
  steps: { command: string; seconds: number }[]; leaves: number; resources: number; bytes: number; seconds: number; bakedAt: string;
}
const count = (value: unknown): number => {
  if (!Number.isInteger(value) || (value as number) <= 0) throw new TypeError('Invalid published-plates bake receipt.');
  return value as number;
};
export function readPlateQuality(value: unknown): PlateQuality {
  if (value !== 'draft' && value !== 'full' && value !== 'publish') throw new TypeError('A plate job is a draft, a full bake or a publish.');
  return value;
}
export function readPlateBakeReceipt(value: unknown): PlateBakeReceipt {
  if (!isRecord(value) || value.schema !== PLATE_BAKE_SCHEMA || typeof value.object !== 'string' || typeof value.directory !== 'string' ||
      !Array.isArray(value.steps) || !value.steps.every(step => isRecord(step) && typeof step.command === 'string' && typeof step.seconds === 'number') ||
      typeof value.bakedAt !== 'string' || Number.isNaN(Date.parse(value.bakedAt)) || typeof value.seconds !== 'number' || !(value.seconds >= 0))
    throw new TypeError('Invalid published-plates bake receipt.');
  const quality = readPlateQuality(value.quality);
  plateObjectId(value.object);
  if (value.directory !== (quality === 'draft' ? platesDirectory(value.object) : value.object)) throw new TypeError('Invalid published-plates bake receipt.');
  return { schema: PLATE_BAKE_SCHEMA, object: value.object, quality, directory: value.directory, steps: value.steps as PlateBakeReceipt['steps'],
    leaves: count(value.leaves), resources: count(value.resources), bytes: count(value.bytes), seconds: value.seconds, bakedAt: value.bakedAt };
}
