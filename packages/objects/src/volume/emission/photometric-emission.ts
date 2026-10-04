import type { SkyBounds } from './coordinates.js';
import { readPhotometricMgeRecipe, type PhotometricMgeRecipe } from './photometric-mge.js';
export const PHOTOMETRIC_ENVELOPE_SCHEMA = 'cssearth-photometric-envelope@1';

export interface RetainedPhotometricEnvelope {
  schema: typeof PHOTOMETRIC_ENVELOPE_SCHEMA; priorIdentity: string; recipe: PhotometricMgeRecipe;
  width: number; height: number; bounds: SkyBounds; zRange: [number, number]; gain: number[];
}
const record = (v: unknown): v is Record<string, unknown> => v !== null && typeof v === 'object' && !Array.isArray(v);
const pair = (v: unknown): v is [number, number] => Array.isArray(v) && v.length === 2 && v.every(Number.isFinite);
export function readPhotometricEnvelope(v: unknown): RetainedPhotometricEnvelope {
  if (!record(v) || v.schema !== PHOTOMETRIC_ENVELOPE_SCHEMA || typeof v.priorIdentity !== 'string' || !/^[a-z0-9][a-z0-9-]{0,159}$/.test(v.priorIdentity) ||
      typeof v.width !== 'number' || !Number.isInteger(v.width) || v.width < 2 || v.width > 2048 ||
      typeof v.height !== 'number' || !Number.isInteger(v.height) || v.height < 2 || v.height > 2048 || v.width * v.height > 2_000_000 ||
      !record(v.bounds) || !pair(v.bounds.min) || !pair(v.bounds.max) ||
      !pair(v.zRange) || v.zRange[0] >= v.zRange[1] || !Array.isArray(v.gain) || v.gain.length !== v.width * v.height ||
      !v.gain.every((n): n is number => typeof n === 'number' && Number.isFinite(n) && n >= 0)) throw new TypeError('Invalid retained photometric envelope.');
  const maximum = v.bounds.max;
  if (v.bounds.min.some((n, i) => n >= maximum[i]!)) throw new TypeError('Invalid retained envelope bounds.');
  const recipe = readPhotometricMgeRecipe(v.recipe);
  if (!recipe.envelope) throw new TypeError('Retained envelope requires explicit recipe settings.');
  return { schema: v.schema, priorIdentity: v.priorIdentity, recipe, width: v.width, height: v.height,
    bounds: { min: v.bounds.min, max: v.bounds.max }, zRange: v.zRange, gain: v.gain };
}
export interface EnvelopeColors { width: number; height: number; rgb: number[] }
export function readEnvelopeColors(v: unknown, envelope: RetainedPhotometricEnvelope): EnvelopeColors {
  if (!record(v) || typeof v.width !== 'number' || !Number.isInteger(v.width) || v.width < 2 || v.width > envelope.width ||
      typeof v.height !== 'number' || !Number.isInteger(v.height) || v.height < 2 || v.height > envelope.height ||
      !Array.isArray(v.rgb) || v.rgb.length !== v.width * v.height * 3 || !v.rgb.every((n): n is number => typeof n === 'number' && Number.isFinite(n) && n >= 0 && n <= 255))
    throw new TypeError('Missing or invalid retained envelope colors.');
  return { width: v.width, height: v.height, rgb: v.rgb };
}
