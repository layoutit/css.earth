import { sourceRecordReaders } from '@cssearth/objects';
import type { KeplerianElements } from '../../src/kepler.ts';
import type { VectorRow } from './horizons.mts';

export interface ElementRecord { query: string; elements: KeplerianElements }
export interface VectorFixture { query: string; rows: VectorRow[] }
export interface StarRecord { hipparcosId?: number; rightAscensionDegrees: number; declinationDegrees: number; positionEpochJulianYear: number; distanceParsecs: number;
  properMotionRaMasPerYear: number; properMotionDecMasPerYear: number; radialVelocityKmPerS: number;
  /** The star this one is measured to be bound to, with no measured orbit: a wide binary companion. */
  boundTo?: string;
  sources: { position: string; distance: string; properMotion: string; radialVelocity: string; binary?: string } }

export const { objectValue, stringValue, numberValue, arrayValue, numberVector } = sourceRecordReaders;
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
  const star = { ...(record.hipparcosId === undefined ? {} : { hipparcosId: numberValue(record.hipparcosId) }), rightAscensionDegrees: numberValue(record.rightAscensionDegrees), declinationDegrees: numberValue(record.declinationDegrees),
    positionEpochJulianYear: numberValue(record.positionEpochJulianYear), distanceParsecs: numberValue(record.distanceParsecs),
    properMotionRaMasPerYear: numberValue(record.properMotionRaMasPerYear), properMotionDecMasPerYear: numberValue(record.properMotionDecMasPerYear),
    radialVelocityKmPerS: numberValue(record.radialVelocityKmPerS),
    ...(record.presentationUp === undefined ? {} : { presentationUp: record.presentationUp === 'display-axis' ? 'display-axis' as const : (() => { throw new TypeError('Star presentationUp must be display-axis when stated.'); })() }),
    ...(record.boundTo === undefined ? {} : { boundTo: stringValue(record.boundTo) }),
    sources: { position: stringValue(sources.position), distance: stringValue(sources.distance), properMotion: stringValue(sources.properMotion), radialVelocity: stringValue(sources.radialVelocity),
      ...(sources.binary === undefined ? {} : { binary: stringValue(sources.binary) }) } };
  if (star.hipparcosId !== undefined && (!Number.isSafeInteger(star.hipparcosId) || star.hipparcosId <= 0)) throw new TypeError('Hipparcos identity must be a positive integer.');
  // A bound companion states the measurement that binds it; nothing else may claim one.
  if ((star.boundTo === undefined) !== (star.sources.binary === undefined)) throw new TypeError('A bound star names its companion and the measurement that binds it.');
  if (star.rightAscensionDegrees < 0 || star.rightAscensionDegrees >= 360 || Math.abs(star.declinationDegrees) > 90 ||
      // Zero is the observer's own place: a scale of the universe centred on the Sun (the Nearby Universe) has no other.
      !(star.distanceParsecs >= 0) ||
      Object.values(star.sources).some(text => !text.trim())) throw new TypeError('Invalid star astrometry.');
  return star;
}

export { readHostedOrbitRecord, type HostedOrbitRecord, type HostedOrbitPredictionRecord } from '../../src/hosted-orbits/record.ts';
