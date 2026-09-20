import type { KeplerianElements } from '../../src/kepler.ts';
import type { VectorRow } from './horizons.mts';

export interface ElementRecord { query: string; elements: KeplerianElements }
export interface VectorFixture { query: string; rows: VectorRow[] }
export interface StarRecord { rightAscensionDegrees: number; declinationDegrees: number; positionEpochJulianYear: number; distanceParsecs: number;
  properMotionRaMasPerYear: number; properMotionDecMasPerYear: number; radialVelocityKmPerS: number;
  /** The star this one is measured to be bound to, with no measured orbit: a wide binary companion. */
  boundTo?: string;
  sources: { position: string; distance: string; properMotion: string; radialVelocity: string; binary?: string } }

export interface HostedOrbitRecord { periodDays: number; semiMajorAxisStellarRadii: number; inclinationDegrees: number; eccentricity: number;
  argumentOfPeriapsisDegrees?: number; epochDefinition?: 'inferior-conjunction';
  transitTimeBmjdTdb: number; ascendingNodePositionAngleDegrees: number;
  sources: { period: string; shape: string; phase: string; orientation: string; eccentricity?: string; argumentOfPeriapsis?: string } }

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
    ...(record.boundTo === undefined ? {} : { boundTo: stringValue(record.boundTo) }),
    sources: { position: stringValue(sources.position), distance: stringValue(sources.distance), properMotion: stringValue(sources.properMotion), radialVelocity: stringValue(sources.radialVelocity),
      ...(sources.binary === undefined ? {} : { binary: stringValue(sources.binary) }) } };
  // A bound companion states the measurement that binds it; nothing else may claim one.
  if ((star.boundTo === undefined) !== (star.sources.binary === undefined)) throw new TypeError('A bound star names its companion and the measurement that binds it.');
  if (star.rightAscensionDegrees < 0 || star.rightAscensionDegrees >= 360 || Math.abs(star.declinationDegrees) > 90 || !(star.distanceParsecs > 0) ||
      Object.values(star.sources).some(text => !text.trim())) throw new TypeError('Invalid star astrometry.');
  return star;
}

/** Preserve the selected published solution. Eccentric orbits need a sourced planet-centric periapsis and an explicit epoch convention. */
export function readHostedOrbitRecord(value: unknown): HostedOrbitRecord {
  const record = objectValue(value), sources = objectValue(record.sources, 'hosted orbit sources');
  const eccentricity = numberValue(record.eccentricity, 'hosted eccentricity');
  if (!(eccentricity >= 0 && eccentricity < 1)) throw new TypeError('Hosted eccentricity must be in [0, 1).');
  if (record.epochDefinition !== undefined && record.epochDefinition !== 'inferior-conjunction') throw new TypeError('Unsupported hosted orbit epoch definition.');
  if (eccentricity > 0 && (record.argumentOfPeriapsisDegrees === undefined || record.epochDefinition !== 'inferior-conjunction' ||
      sources.eccentricity === undefined || sources.argumentOfPeriapsis === undefined)) throw new TypeError('An eccentric hosted orbit needs planet-centric periapsis, an inferior-conjunction epoch and sources for both eccentricity and periapsis.');
  const orbit: HostedOrbitRecord = { periodDays: numberValue(record.periodDays), semiMajorAxisStellarRadii: numberValue(record.semiMajorAxisStellarRadii),
    inclinationDegrees: numberValue(record.inclinationDegrees), eccentricity, transitTimeBmjdTdb: numberValue(record.transitTimeBmjdTdb),
    ...(record.argumentOfPeriapsisDegrees === undefined ? {} : { argumentOfPeriapsisDegrees: numberValue(record.argumentOfPeriapsisDegrees) }),
    ...(record.epochDefinition === undefined ? {} : { epochDefinition: 'inferior-conjunction' }),
    ascendingNodePositionAngleDegrees: numberValue(record.ascendingNodePositionAngleDegrees),
    sources: { period: stringValue(sources.period), shape: stringValue(sources.shape), phase: stringValue(sources.phase), orientation: stringValue(sources.orientation),
      ...(sources.eccentricity === undefined ? {} : { eccentricity: stringValue(sources.eccentricity) }),
      ...(sources.argumentOfPeriapsis === undefined ? {} : { argumentOfPeriapsis: stringValue(sources.argumentOfPeriapsis) }) } };
  if (!(orbit.periodDays > 0) || !(orbit.semiMajorAxisStellarRadii > 1) || orbit.inclinationDegrees < 0 || orbit.inclinationDegrees > 180 ||
      orbit.ascendingNodePositionAngleDegrees < 0 || orbit.ascendingNodePositionAngleDegrees >= 360 ||
      orbit.argumentOfPeriapsisDegrees !== undefined && (orbit.argumentOfPeriapsisDegrees < 0 || orbit.argumentOfPeriapsisDegrees >= 360) ||
      orbit.semiMajorAxisStellarRadii * (1 - eccentricity) <= 1 || Object.values(orbit.sources).some(text => !text.trim())) {
    throw new TypeError('Invalid hosted orbit.');
  }
  return orbit;
}
