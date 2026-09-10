import type { KeplerianElements } from '../../src/kepler.ts';
import type { VectorRow } from './horizons.mts';

export interface ElementRecord { query: string; elements: KeplerianElements }
export interface VectorFixture { query: string; rows: VectorRow[] }

export function objectValue(value: unknown, label = 'record'): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new TypeError(`${label} must be an object`);
  return value as Record<string, unknown>;
}
export function stringValue(value: unknown, label = 'value'): string {
  if (typeof value !== 'string') throw new TypeError(`${label} must be a string`);
  return value;
}
export function numberValue(value: unknown, label = 'value'): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) throw new TypeError(`${label} must be finite`);
  return value;
}
export function arrayValue(value: unknown, label = 'value'): unknown[] {
  if (!Array.isArray(value)) throw new TypeError(`${label} must be an array`);
  return value;
}
export function numberVector(value: unknown): [number, number, number] {
  const values = arrayValue(value);
  if (values.length !== 3) throw new TypeError('A source vector requires exactly three components');
  return [numberValue(values[0]), numberValue(values[1]), numberValue(values[2])];
}
export function readElementRecord(value: unknown): ElementRecord {
  const record = objectValue(value), elements = objectValue(record.elements);
  return { ...record, query: stringValue(record.query), elements: { ...elements,
    epochJdTt: numberValue(elements.epochJdTt), semiMajorAxisKm: numberValue(elements.semiMajorAxisKm),
    eccentricity: numberValue(elements.eccentricity), inclinationRad: numberValue(elements.inclinationRad),
    ascendingNodeRad: numberValue(elements.ascendingNodeRad), argumentOfPeriapsisRad: numberValue(elements.argumentOfPeriapsisRad),
    meanAnomalyAtEpochRad: numberValue(elements.meanAnomalyAtEpochRad), meanMotionRadPerDay: numberValue(elements.meanMotionRadPerDay),
  } };
}
export function readVectorFixture(value: unknown): VectorFixture {
  const record = objectValue(value);
  return { ...record, query: stringValue(record.query), rows: arrayValue(record.rows).map(value => {
    const row = objectValue(value);
    return { ...row, jd: numberValue(row.jd), position: numberVector(row.position), velocity: numberVector(row.velocity) };
  }) };
}
export function recordMap<T>(value: unknown, parse: (record: unknown) => T): Record<string, T> {
  return Object.fromEntries(Object.entries(objectValue(value)).map(([key, record]) => [key, parse(record)]));
}
