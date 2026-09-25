import type { DensityVolumeFrame } from '@cssearth/objects';
import type { Bounds3, Vector3 } from './volume-recipe.ts';

export interface JointVolumePin { path: string }
export interface JointVolumeResult {
  schema: 'cssearth-joint-fit-volume@1';
  id: string;
  volume: JointVolumePin;
  frame: DensityVolumeFrame;
  boundsArcsec: Bounds3;
  coordinates: {
    axes: readonly ['west', 'north', 'away'];
    localOriginArcsec: Vector3;
    earthView: 'observer-at-negative-z-looking-away';
  };
  sampling: { sliceCounts: { x: 48; y: 48; z: 48 }; imageWidth: 256; samplesPerSlab: 2 };
}

/** Validates the complete worker-to-browser scene descriptor without loading either runtime. */
export function readJointVolumeResult(value: unknown): JointVolumeResult {
  const result = record(value), frame = record(result.frame), sourceBounds = readBounds(result.boundsArcsec);
  const coordinates = record(result.coordinates), sampling = record(result.sampling), counts = record(sampling.sliceCounts);
  const frameBounds = readBounds(frame.boundsUnits), origin = coordinates.localOriginArcsec;
  const expectedOrigin = sourceBounds?.min.map((entry, axis) => (entry + sourceBounds.max[axis]!) / 2);
  const expectedLocal = expectedOrigin && { min: sourceBounds!.min.map((entry, axis) => entry - expectedOrigin[axis]!),
    max: sourceBounds!.max.map((entry, axis) => entry - expectedOrigin[axis]!) };
  if (result.schema !== 'cssearth-joint-fit-volume@1' || !safeId(result.id) || !pin(result.volume) || !sourceBounds ||
      frame.referenceFrame !== 'lab-sky-angular' || frame.epochJdTt !== 2451545 || frame.metersPerUnit !== 1 ||
      !sameTuple(frame.originM, [0, 0, 0]) || !sameTuple(frame.localToReferenceXyzw, [0, 0, 0, 1]) || !frameBounds ||
      !Array.isArray(coordinates.axes) || coordinates.axes.join(',') !== 'west,north,away' ||
      !triple(origin) || !sameTuple(origin, expectedOrigin) || !sameTuple(frameBounds.min, expectedLocal?.min) ||
      !sameTuple(frameBounds.max, expectedLocal?.max) || coordinates.earthView !== 'observer-at-negative-z-looking-away' ||
      sampling.imageWidth !== 256 || sampling.samplesPerSlab !== 2 ||
      ['x', 'y', 'z'].some(axis => counts[axis] !== 48)) {
    throw new TypeError('Invalid joint-fit volume result.');
  }
  return value as JointVolumeResult;
}

function record(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {};
}
function triple(value: unknown): value is [number, number, number] {
  return Array.isArray(value) && value.length === 3 && value.every(Number.isFinite);
}
function readBounds(value: unknown): { min: [number, number, number]; max: [number, number, number] } | null {
  const item = record(value), min = item.min, max = item.max;
  return triple(min) && triple(max) && min.every((entry, axis) => entry < max[axis]!) ? { min, max } : null;
}
function sameTuple(value: unknown, expected: readonly number[] | undefined): boolean {
  return Array.isArray(expected) && Array.isArray(value) && value.length === expected.length &&
    value.every((entry, axis) => typeof entry === 'number' && Math.abs(entry - expected[axis]!) < 1e-12);
}
function safeId(value: unknown): value is string {
  return typeof value === 'string' && /^[a-z0-9][a-z0-9-]{0,95}$/.test(value);
}
function pin(value: unknown): value is JointVolumePin {
  const item = record(value);
  return typeof item.path === 'string' && item.path.length > 0 && !item.path.startsWith('/') &&
    !item.path.split('/').includes('..') && !/[\\\u0000-\u0020]/.test(item.path);
}
