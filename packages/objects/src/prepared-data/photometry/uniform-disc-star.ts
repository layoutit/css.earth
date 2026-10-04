import { requireFiniteNumber, requireRecord, requireString } from '@cssearth/core';

export const UNIFORM_DISC_STAR_SCHEMA = 'cssearth-uniform-disc-star@1';
export interface UniformDiscStarMeasurements extends Record<string, unknown> {
  schema: typeof UNIFORM_DISC_STAR_SCHEMA;
  radiusKm: number;
  shape: Record<string, unknown> & { path: string; stepDegrees: number };
}
/** expectedPath is the caller's authoring policy, not a format constant. Extra cited fields are retained. */
export function parseUniformDiscStarMeasurements(value: unknown, label: string, expectedPath: string): UniformDiscStarMeasurements {
  const measurements = requireRecord(value, 'measurements');
  if (measurements.schema !== UNIFORM_DISC_STAR_SCHEMA) throw new TypeError(`Unexpected ${label} measurements schema.`);
  const shape = requireRecord(measurements.shape, 'shape');
  if (requireString(shape.path) !== expectedPath) throw new TypeError(`${label} sphere path differs from the authoring tool.`);
  requireFiniteNumber(measurements.radiusKm);
  requireFiniteNumber(shape.stepDegrees);
  return measurements as UniformDiscStarMeasurements;
}
