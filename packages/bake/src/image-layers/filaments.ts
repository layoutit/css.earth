/**
 * Dark filaments found as lines in an image's brightness (Frangi et al. 1998, Medical Image Computing and
 * Computer-Assisted Intervention, LNCS 1496, 130, for dark lines). At each width the log brightness is smoothed by a
 * Gaussian of that width and its curvature read from the Hessian: a dark line curves up strongly across itself (the
 * larger eigenvalue) and little along itself (the smaller). A width's strength is that curvature, scale-normalised and
 * kept where it is line-like (the smaller over the larger eigenvalue within about half), over its 99.5th percentile
 * among the `lit` pixels, at most 1.
 */
export function lineStrengths(brightness: ArrayLike<number>, width: number, height: number, lit: Uint8Array, widthsPx: readonly number[]): Float32Array[] {
  // The log is taken above a floor of a hundredth of the median brightness, so the darkest lanes keep their depth.
  const count = width * height, positive = Array.from(brightness).filter(value => value > 0).sort((a, b) => a - b), floor = Math.max(1e-6, .01 * (positive[positive.length >> 1] ?? 1));
  const log = Float64Array.from({ length: count }, (_, p) => { const value = brightness[p]!; return Math.log(Math.max(floor, Number.isFinite(value) ? value : floor)); });
  return widthsPx.map(sigma => {
    const g = gaussian(log, width, height, sigma), at = (x: number, y: number) => g[Math.min(height - 1, Math.max(0, y)) * width + Math.min(width - 1, Math.max(0, x))]!, own = new Float32Array(count);
    for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
      const xx = at(x + 1, y) - 2 * at(x, y) + at(x - 1, y), yy = at(x, y + 1) - 2 * at(x, y) + at(x, y - 1), xy = (at(x + 1, y + 1) - at(x - 1, y + 1) - at(x + 1, y - 1) + at(x - 1, y - 1)) / 4;
      const mean = (xx + yy) / 2, d = Math.sqrt(((xx - yy) / 2) ** 2 + xy * xy), across = mean + d, along = mean - d;
      if (!(across > 0)) continue;
      const ratio = along / across; own[y * width + x] = sigma * sigma * across * Math.exp(-(ratio * ratio) / .5);
    }
    const values = Array.from(own).filter((_, p) => lit[p]).sort((a, b) => a - b), top = values[Math.floor(values.length * .995)] || 1;
    return Float32Array.from(own, (value, p) => lit[p] ? Math.min(1, value / top) : 0);
  });
}

/** How the line strengths of several images make one filament map. */
export interface FilamentSettings {
  /** Each image's weight. */
  sources: readonly number[];
  /** Each width's weight, the same for every image. */
  widths: readonly number[];
  /** Taken off the weighted strength, as a share of full strength; what is left is spread over the rest. */
  threshold: number;
  /** Then multiplied by this, at most 1, and raised to this power. */
  gain: number; gamma: number;
}

/** A filament map from 0 to 1: for each image the most of its widths' strengths times their weights, those weighted
 * by image and averaged, less `threshold`, times `gain`, to the power `gamma`. */
export function filamentMap(strengths: readonly (readonly Float32Array[])[], settings: FilamentSettings): Float32Array {
  const count = strengths[0]![0]!.length, total = settings.sources.reduce((sum, weight) => sum + weight, 0) || 1;
  return Float32Array.from({ length: count }, (_, p) => {
    let value = 0;
    for (const [image, widths] of strengths.entries()) { const weight = settings.sources[image]!; if (!weight) continue; let best = 0; for (const [index, plane] of widths.entries()) best = Math.max(best, settings.widths[index]! * plane[p]!); value += weight * best; }
    return Math.min(1, Math.max(0, value / total - settings.threshold) / (1 - settings.threshold) * settings.gain) ** settings.gamma;
  });
}

/** A Gaussian blur of `sigma` pixels, clamped at the edges. */
function gaussian(field: Float64Array, width: number, height: number, sigma: number): Float64Array {
  const r = Math.ceil(3 * sigma), kernel = Array.from({ length: 2 * r + 1 }, (_, i) => Math.exp(-((i - r) ** 2) / (2 * sigma * sigma))), sum = kernel.reduce((a, b) => a + b, 0), row = new Float64Array(field.length), out = new Float64Array(field.length);
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) { let total = 0; for (let t = -r; t <= r; t++) total += kernel[t + r]! * field[y * width + Math.min(width - 1, Math.max(0, x + t))]!; row[y * width + x] = total / sum; }
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) { let total = 0; for (let t = -r; t <= r; t++) total += kernel[t + r]! * row[Math.min(height - 1, Math.max(0, y + t)) * width + x]!; out[y * width + x] = total / sum; }
  return out;
}
