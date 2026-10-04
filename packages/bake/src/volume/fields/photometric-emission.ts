/** Retained two-scale light: an explicit smooth density plus finite 3D residual features. */
import { readPhotometricEnvelope, readEnvelopeColors, type EnvelopeColors, type EmissionFieldModel, type EmissionVector3 } from '@cssearth/objects';

import { createEmissionField } from './emission.ts';
import { samplePhotometricMge } from './photometric-mge.ts';
import { createEnvelopeSampler, sampleEnvelopeGrid } from './simulation-envelope.ts';

/** Research and compact replay consume exactly the same retained numbers and arithmetic. */
export function createPhotometricEmission(model: EmissionFieldModel) {
  const finite = createEmissionField(model), retained = model.photometricEnvelope;
  const envelope = retained && readPhotometricEnvelope(retained);
  const sampleEnvelope = envelope && createEnvelopeSampler({ ...envelope, gain: Float32Array.from(envelope.gain) },
    samplePhotometricMge(envelope.recipe));
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
