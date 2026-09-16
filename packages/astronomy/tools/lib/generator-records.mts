import type { KeplerianElements } from '../../src/kepler.ts';
import type { VectorRow } from './horizons.mts';

export interface ElementRecord { query: string; elements: KeplerianElements }
export interface VectorFixture { query: string; rows: VectorRow[] }
export interface StarRecord { rightAscensionDegrees: number; declinationDegrees: number; positionEpochJulianYear: number; distanceParsecs: number;
  properMotionRaMasPerYear: number; properMotionDecMasPerYear: number; radialVelocityKmPerS: number;
  sources: { position: string; distance: string; properMotion: string; radialVelocity: string } }

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
export function readStarRecord(value: unknown): StarRecord {
  const record = objectValue(value), sources = objectValue(record.sources, 'star sources');
  const star = { rightAscensionDegrees: numberValue(record.rightAscensionDegrees), declinationDegrees: numberValue(record.declinationDegrees),
    positionEpochJulianYear: numberValue(record.positionEpochJulianYear), distanceParsecs: numberValue(record.distanceParsecs),
    properMotionRaMasPerYear: numberValue(record.properMotionRaMasPerYear), properMotionDecMasPerYear: numberValue(record.properMotionDecMasPerYear),
    radialVelocityKmPerS: numberValue(record.radialVelocityKmPerS),
    ...(record.presentationUp === undefined ? {} : { presentationUp: record.presentationUp === 'display-axis' ? 'display-axis' as const : (() => { throw new TypeError('Star presentationUp must be display-axis when stated.'); })() }),
    sources: { position: stringValue(sources.position), distance: stringValue(sources.distance), properMotion: stringValue(sources.properMotion), radialVelocity: stringValue(sources.radialVelocity) } };
  if (star.rightAscensionDegrees < 0 || star.rightAscensionDegrees >= 360 || Math.abs(star.declinationDegrees) > 90 || !(star.distanceParsecs > 0) ||
      Object.values(star.sources).some(text => !text.trim())) throw new TypeError('Invalid star astrometry.');
  return star;
}
