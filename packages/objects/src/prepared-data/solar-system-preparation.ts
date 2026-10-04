import { isRecord } from '@cssearth/core';
export { SOLAR_SYSTEM_PREPARATION_SCHEMA } from './source-schema-identifiers.ts';

/** The physical scene source; host admission of prepared sky, lighting and astronomy identities stays separate. */
export interface SolarSceneSource extends Record<string, unknown> {
  bodyId: string; bodyRadiusUnits: number; bodyRadiusKilometers: number; displayName: string;
}
export interface SolarSource { bodyId: string; displayName: string }

/** Identity preparation and navigation deliberately retain their historical, different admission policies. */
export function parseSolarSceneSource(value: unknown): Readonly<SolarSource>;
export function parseSolarSceneSource(value: unknown, admission: 'units'): { bodyRadiusUnits: number; geometryScale: number };
export function parseSolarSceneSource(value: unknown, admission?: 'units') {
  if (admission === 'units') {
    // The original navigation read used JavaScript property/coercion semantics, without schema admission.
    const source = Object(value) as Record<string, unknown>;
    return { bodyRadiusUnits: Number(source.bodyRadiusUnits), geometryScale: Number(source.geometryScale ?? 1) };
  }
  if (!isRecord(value)) throw new TypeError('solar-system source must be an object.');
  if (typeof value.bodyId !== 'string' || typeof value.displayName !== 'string') throw new TypeError('Solar-system source is invalid.');
  return Object.freeze({ bodyId: value.bodyId, displayName: value.displayName });
}
