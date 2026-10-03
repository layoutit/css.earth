import { requireRecord } from '@cssearth/core';

export const SYNCHRONOUS_ROTATION_SCHEMA = 'cssearth-synchronous-rotation@1';
export interface SynchronousRotation {
  readonly schema: typeof SYNCHRONOUS_ROTATION_SCHEMA;
  readonly host: string;
  readonly source: string;
  readonly qualification: string;
  readonly coordinateSystem: string;
}

/** Attribution admission only: host identity is checked against the evaluated orbit by bake. */
export function parseSynchronousRotation(value: unknown) {
  const source = requireRecord(value, 'Rotation source');
  if (source.schema !== SYNCHRONOUS_ROTATION_SCHEMA || typeof source.source !== 'string' || !source.source.trim() || typeof source.qualification !== 'string' || !source.qualification.trim() ||
      typeof source.coordinateSystem !== 'string' || !source.coordinateSystem.trim()) throw new TypeError('Invalid synchronous rotation source.');
  return { schema: SYNCHRONOUS_ROTATION_SCHEMA, host: source.host, source: source.source,
    qualification: source.qualification, coordinateSystem: source.coordinateSystem };
}
