/** Retained two-scale light: an explicit smooth density plus finite 3D residual features. */
import type { EmissionFieldModel, EmissionVector3, SkyBounds } from '../contracts/emission.ts';
import { createEmissionField } from './emission.ts';
import { readPhotometricMgeRecipe, samplePhotometricMge, type PhotometricMgeRecipe } from './photometric-mge.ts';
import { createEnvelopeSampler, sampleEnvelopeGrid } from './simulation-envelope.ts';

export interface RetainedPhotometricEnvelope {
  schema: 'cssearth-photometric-envelope@1'; priorIdentity: string; recipe: PhotometricMgeRecipe;
  width: number; height: number; bounds: SkyBounds; zRange: [number, number]; gain: number[];
}
const record = (v: unknown): v is Record<string, unknown> => v !== null && typeof v === 'object' && !Array.isArray(v);
const pair = (v: unknown): v is [number, number] => Array.isArray(v) && v.length === 2 && v.every(Number.isFinite);
export function readPhotometricEnvelope(v: unknown): RetainedPhotometricEnvelope {
  if (!record(v) || v.schema !== 'cssearth-photometric-envelope@1' || typeof v.priorIdentity !== 'string' || !/^[a-f0-9]{64}$/.test(v.priorIdentity) ||
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
/** Research and compact replay consume exactly the same retained numbers and arithmetic. */
export function createPhotometricEmission(model: EmissionFieldModel) {
  const finite = createEmissionField(model), retained = model.photometricEnvelope;
  const envelope = retained && readPhotometricEnvelope(retained);
  const sampleEnvelope = envelope && createEnvelopeSampler({ ...envelope, gain: Float32Array.from(envelope.gain) },
    { identity: envelope.priorIdentity, ...samplePhotometricMge(envelope.recipe) });
  const bounds = envelope ? { min: [...finite.bounds.min] as EmissionVector3, max: [...finite.bounds.max] as EmissionVector3 } : finite.bounds;
  if (envelope) for (let axis = 0; axis < 3; axis++) {
    bounds.min[axis] = Math.min(bounds.min[axis]!, axis === 2 ? envelope.zRange[0] : envelope.bounds.min[axis]!);
    bounds.max[axis] = Math.max(bounds.max[axis]!, axis === 2 ? envelope.zRange[1] : envelope.bounds.max[axis]!);
  }
  const sampleEmission: typeof finite.sampleEmission = (x, y, z, out) => {
    finite.sampleEmission(x, y, z, out);
    const extra = sampleEnvelope?.(x, y, z) ?? 0;
    out[0] = out[1] = out[2] = out[0]! + extra;
  };
  const createMaterialSampler = (colors: Parameters<typeof finite.createMaterialSampler>[0], envelopeColors?: EnvelopeColors) => {
    const sampleFinite = finite.createMaterialSampler(colors);
    if (!envelope || !sampleEnvelope) {
      if (envelopeColors !== undefined) throw new TypeError('Envelope colors have no retained envelope.');
      return sampleFinite;
    }
    const coarse = readEnvelopeColors(envelopeColors, envelope), coarseGrid = { ...envelope, width: coarse.width, height: coarse.height }, light: EmissionVector3 = [0, 0, 0], rgb: EmissionVector3 = [0, 0, 0];
    return (x: number, y: number, z: number, out: EmissionVector3): boolean => {
      finite.sampleEmission(x, y, z, light);
      const componentLight = light[0], envelopeLight = sampleEnvelope(x, y, z), total = componentLight + envelopeLight;
      if (!(total > 0)) return false;
      if (!sampleFinite(x, y, z, out)) out[0] = out[1] = out[2] = 255;
      if (!sampleEnvelopeGrid(coarseGrid, coarse.rgb, 3, x, y, rgb)) rgb[0] = rgb[1] = rgb[2] = 255;
      for (let c = 0; c < 3; c++) {
        const mixed = (componentLight * out[c]! + envelopeLight * rgb[c]!) / total;
        if (!Number.isFinite(mixed)) throw new TypeError('Photometric material mixture must remain finite.');
        // Validated colors and nonnegative light form a convex mixture. Bound its floating-point
        // roundoff at the channel endpoints (a real saturated sample produced 255.00000000000003).
        out[c] = Math.min(255, Math.max(0, mixed));
      }
      return true;
    };
  };
  return { finite, bounds, sampleEmission, createMaterialSampler };
}
