export const DATASET_TONE_CURVE_SCHEMA = 'cssearth-dataset-tone-curve@1';

/**
 * One dataset's fitted tone curve: per channel, a monotone piecewise-linear map from the analytic render level
 * that channel would have without it (front-projection byte × material chromaticity / 255, after any channel
 * gain) to the render level wanted. It is fitted from paired pixels against the dataset's own image
 * (`dataset-tone-fit`) and applied at bake time only. The material cannot exceed its alpha, so where the curve
 * asks for more light than the shared opacity carries the channel clips at 255: that loss is reported by the
 * fit, never hidden.
 */
export interface DatasetToneCurve {
  schema: typeof DATASET_TONE_CURVE_SCHEMA;
  /** Strictly increasing input render levels from 0 to 255. */
  knots: readonly number[];
  /** Per channel R, G, B: output render level at each knot; starts at 0 and never decreases. */
  channels: readonly [readonly number[], readonly number[], readonly number[]];
}
export function validateDatasetToneCurve(value: unknown): DatasetToneCurve {
  const v = value as DatasetToneCurve | null;
  if (!v || typeof v !== 'object' || v.schema !== DATASET_TONE_CURVE_SCHEMA || !Array.isArray(v.knots) ||
    v.knots.length < 2 || v.knots.length > 257 || v.knots[0] !== 0 || v.knots[v.knots.length - 1] !== 255 ||
    v.knots.some((k, i) => typeof k !== 'number' || !Number.isFinite(k) || (i > 0 && !(k > v.knots[i - 1]!))) ||
    !Array.isArray(v.channels) || v.channels.length !== 3 ||
    v.channels.some(values => !Array.isArray(values) || values.length !== v.knots.length || values[0] !== 0 ||
      values.some((y, i) => typeof y !== 'number' || !Number.isFinite(y) || y < 0 || y > 1020 || (i > 0 && y < values[i - 1]!))))
    throw new TypeError('A dataset tone curve must be monotone per-channel knots from 0 to 255 starting at 0.');
  return v;
}
