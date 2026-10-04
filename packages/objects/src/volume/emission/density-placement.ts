/** Authored density placement wire contract; transforms stay with preparation. */
import { requireFiniteTriple as triple, requireFiniteNumber as finite, requireRecord as record } from '@cssearth/core';
import type { Vector3 } from './coordinates.ts';

export const DENSITY_PLACEMENT_SCHEMA = 'cssearth-density-placement@1';
export interface DensityPlacement {
  schema: typeof DENSITY_PLACEMENT_SCHEMA; scale: number; rotationZDegrees: number;
  pivotUnits: Vector3; translationUnits: Vector3;
}
export function parseDensityPlacement(input: unknown): DensityPlacement {
  const value = record(input, 'density placement');
  if (value.schema !== DENSITY_PLACEMENT_SCHEMA) throw new TypeError('Invalid authored density placement schema.');
  const scale = finite(value.scale, 'density placement scale');
  if (!(scale > 0)) throw new TypeError('Density placement scale must be positive.');
  return { schema: value.schema, scale, rotationZDegrees: finite(value.rotationZDegrees, 'density placement rotation'),
    pivotUnits: triple(value.pivotUnits, 'density placement pivot'), translationUnits: triple(value.translationUnits, 'density placement translation') };
}
