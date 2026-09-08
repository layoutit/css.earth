/** Pure density-gate math for offline prepared cloud textures. */
export interface CloudDensityFilter { cutoff: number; softness: number; showRemoved: boolean }
export interface IntegratedSignalField { values: Float32Array; width: number; height: number;
  bounds: { min: [number, number]; max: [number, number] }; observerDistance: number }

/** Samples one fixed Earth-facing integrated signal along every point on its calibrated ray. */
export function createIntegratedSignalSampler(field: IntegratedSignalField): (x: number, y: number, z: number) => number {
  const { values, width, height, bounds, observerDistance } = field;
  if (!Number.isInteger(width) || width < 1 || !Number.isInteger(height) || height < 1 || values.length !== width * height ||
      values.some(value => !Number.isFinite(value) || value < 0) || !(observerDistance > 0) || !Number.isFinite(observerDistance) ||
      bounds.min.some((value, axis) => !Number.isFinite(value) || !(value < bounds.max[axis]!))) {
    throw new TypeError('Integrated cloud signal field is invalid.');
  }
  const maximum = values.reduce((result, value) => Math.max(result, value), 0);
  if (!(maximum > 0)) throw new TypeError('Integrated cloud signal has no positive global maximum.');
  return (x, y, z) => {
    const perspective = 1 + z / observerDistance;
    if (!(perspective > 0) || ![x, y, z].every(Number.isFinite)) return 0;
    const tangentX = x / perspective, tangentY = y / perspective;
    const gx = (tangentX - bounds.min[0]) / (bounds.max[0] - bounds.min[0]) * width - .5;
    const gy = (bounds.max[1] - tangentY) / (bounds.max[1] - bounds.min[1]) * height - .5;
    if (gx < -.5 || gx > width - .5 || gy < -.5 || gy > height - .5) return 0;
    const x0 = Math.max(0, Math.min(width - 1, Math.floor(gx))), y0 = Math.max(0, Math.min(height - 1, Math.floor(gy)));
    const x1 = Math.min(width - 1, x0 + 1), y1 = Math.min(height - 1, y0 + 1);
    const tx = Math.max(0, Math.min(1, gx - x0)), ty = Math.max(0, Math.min(1, gy - y0));
    return ((1 - ty) * ((1 - tx) * values[y0 * width + x0]! + tx * values[y0 * width + x1]!) +
      ty * ((1 - tx) * values[y1 * width + x0]! + tx * values[y1 * width + x1]!)) / maximum;
  };
}

export function validateCloudDensityFilter(value: CloudDensityFilter): CloudDensityFilter {
  if (!value || !Number.isFinite(value.cutoff) || value.cutoff < 0 || value.cutoff > 1 ||
      !Number.isFinite(value.softness) || value.softness < 0 || value.softness > 1 ||
      typeof value.showRemoved !== 'boolean') throw new TypeError('Cloud density filter is invalid.');
  return { cutoff: value.cutoff, softness: value.softness, showRemoved: value.showRemoved };
}

/** Smooth high-density membership; softness is the transition width relative to cutoff. */
export function cloudDensityWeight(density: number, filter: CloudDensityFilter): number {
  const { cutoff, softness } = validateCloudDensityFilter(filter);
  if (cutoff === 0) return 1;
  const value = Math.max(0, Math.min(1, density));
  if (softness === 0) return value >= cutoff ? 1 : 0;
  const width = cutoff * softness, low = cutoff - width / 2, t = Math.max(0, Math.min(1, (value - low) / width));
  return t * t * (3 - 2 * t);
}

/** Partitions optical alpha without renormalizing discarded light. */
export function partitionCloudAlpha(alpha: number, weight: number, removed: boolean): number {
  if (![alpha, weight].every(Number.isFinite) || alpha < 0 || alpha > 1 || weight < 0 || weight > 1) {
    throw new TypeError('Cloud alpha partition inputs must be within [0,1].');
  }
  const fraction = removed ? 1 - weight : weight;
  if (fraction === 0 || alpha === 0) return 0;
  if (fraction === 1) return alpha;
  if (alpha === 1) return 1;
  return -Math.expm1(Math.log1p(-alpha) * fraction);
}

export function filterCloudDensityRgba(input: Uint8Array, normalizedDensity: Float32Array,
  filter: CloudDensityFilter): Uint8Array {
  if (input.length % 4 || normalizedDensity.length * 4 !== input.length) {
    throw new TypeError('Cloud density map must match RGBA pixels.');
  }
  const valid = validateCloudDensityFilter(filter), output = new Uint8Array(input);
  for (let pixel = 0; pixel < normalizedDensity.length; pixel++) {
    const alpha = input[4 * pixel + 3]! / 255;
    const weight = cloudDensityWeight(normalizedDensity[pixel]!, valid);
    output[4 * pixel + 3] = Math.round(255 * partitionCloudAlpha(alpha, weight, valid.showRemoved));
  }
  return output;
}
