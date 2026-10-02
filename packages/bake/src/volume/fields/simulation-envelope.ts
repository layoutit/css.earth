import { type SimulationEnvelopeSettings, type SkyBounds, type SimulationDepthPrior } from '@cssearth/objects';
/**
 * Low-frequency emission that keeps a pinned density's own 3D shape, scaled per sky position to the image.
 *
 * Relocated from the reconstruction package so bake-time replay can sample an accepted envelope without
 * depending on the fitting methods. Arithmetic order, coordinate conventions and validator bounds are
 * unchanged; the fit itself stays with its scientific owner.
 */

export interface SimulationEnvelopeGrid {
  width: number; height: number; bounds: SkyBounds; zRange: [number, number];
  /** Row-major gain per fit pixel (top row first, like the image). */
  gain: Float32Array;
}

/** The trust ramp's half-saturation quantile: an authored envelope setting, else the long-standing 0.9. */
export const DEFAULT_CHROMA_HALF_SATURATION_QUANTILE = .9;
/** The sky quantile removed before chromaticity is measured: an authored setting, else the median. */
export const DEFAULT_CHROMA_SKY_QUANTILE = .5;
/** No footprint-edge taper on chromaticity unless one is authored. */
export const DEFAULT_CHROMA_COVERAGE_TAPER = 0;
export interface EnvelopeChromaSettings { halfSaturationQuantile: number; skyQuantile: number; coverageTaper: number }
/** The authored chroma settings of one envelope, with the long-standing defaults filled in. */
export const envelopeChromaSettings = (settings: SimulationEnvelopeSettings): EnvelopeChromaSettings => ({
  halfSaturationQuantile: settings.chromaHalfSaturationQuantile ?? DEFAULT_CHROMA_HALF_SATURATION_QUANTILE,
  skyQuantile: settings.chromaSkyQuantile ?? DEFAULT_CHROMA_SKY_QUANTILE,
  coverageTaper: settings.chromaCoverageTaper ?? DEFAULT_CHROMA_COVERAGE_TAPER,
});

function gaussianKernel(sigma: number): Float64Array {
  const radius = Math.ceil(3 * sigma), kernel = new Float64Array(2 * radius + 1);
  for (let i = -radius; i <= radius; i++) kernel[i + radius] = Math.exp(-.5 * (i / sigma) ** 2);
  return kernel;
}
/** Separable Gaussian blur of values × weights; divide two results for normalized convolution. */
export function blurWeighted(values: ArrayLike<number>, weights: ArrayLike<number>, width: number, height: number, sigma: number): Float64Array {
  const kernel = gaussianKernel(sigma), radius = (kernel.length - 1) / 2, row = new Float64Array(width * height), out = new Float64Array(width * height);
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
    let sum = 0;
    for (let k = -radius; k <= radius; k++) { const xx = x + k; if (xx < 0 || xx >= width) continue; const p = y * width + xx; sum += kernel[k + radius]! * values[p]! * weights[p]!; }
    row[y * width + x] = sum;
  }
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
    let sum = 0;
    for (let k = -radius; k <= radius; k++) { const yy = y + k; if (yy < 0 || yy >= height) continue; sum += kernel[k + radius]! * row[yy * width + x]!; }
    out[y * width + x] = sum;
  }
  return out;
}

export const pixelCenter = (bounds: SkyBounds, width: number, height: number, p: number): [number, number] => [
  bounds.min[0] + (p % width + .5) * (bounds.max[0] - bounds.min[0]) / width,
  bounds.max[1] - (Math.floor(p / width) + .5) * (bounds.max[1] - bounds.min[1]) / height,
];

/** Bilinear lookup in a row-major sky grid; false outside the grid. */
export function sampleEnvelopeGrid(grid: { width: number; height: number; bounds: SkyBounds }, values: ArrayLike<number>, channels: number, x: number, y: number, out: number[]): boolean {
  const u = (x - grid.bounds.min[0]) / (grid.bounds.max[0] - grid.bounds.min[0]) * grid.width - .5;
  const v = (grid.bounds.max[1] - y) / (grid.bounds.max[1] - grid.bounds.min[1]) * grid.height - .5;
  if (!(u >= -.5 && v >= -.5 && u <= grid.width - .5 && v <= grid.height - .5)) return false;
  const cu = Math.min(grid.width - 1, Math.max(0, u)), cv = Math.min(grid.height - 1, Math.max(0, v));
  const ix = Math.min(grid.width - 2, Math.floor(cu)), iy = Math.min(grid.height - 2, Math.floor(cv)), fx = cu - ix, fy = cv - iy;
  for (let c = 0; c < channels; c++) {
    const at = (xx: number, yy: number) => values[(yy * grid.width + xx) * channels + c]!;
    out[c] = (at(ix, iy) * (1 - fx) + at(ix + 1, iy) * fx) * (1 - fy) + (at(ix, iy + 1) * (1 - fx) + at(ix + 1, iy + 1) * fx) * fy;
  }
  return true;
}

export function createEnvelopeSampler(grid: SimulationEnvelopeGrid, prior: SimulationDepthPrior) {
  const scratch = [0];
  return (x: number, y: number, z: number): number => {
    if (z < grid.zRange[0] || z > grid.zRange[1] || !sampleEnvelopeGrid(grid, grid.gain, 1, x, y, scratch) || !(scratch[0]! > 0)) return 0;
    return scratch[0]! * prior.sampleDensity(x, y, z);
  };
}

/**
 * Smoothed, peak-normalized chromaticity of one registered image at envelope scale; neutral where
 * unobserved or black.
 *
 * Three authored settings shape what color this reports; each default is the long-standing behaviour and
 * `SimulationEnvelopeSettings` documents why each one is authored rather than fixed.
 *  - `halfSaturationQuantile` places the trust ramp: the smoothed signal at that quantile is where a pixel
 *    keeps half its measured color. At the default 0.9 the whole faint halo of a body whose light spans a
 *    wide dynamic range is neutralised, which reads as a grey halo around a colored core.
 *  - `skyQuantile` is the per-channel level removed as this image's sky before any color is measured.
 *  - `coverageTaper` fades color to neutral across the observed footprint edge, the way the gain already
 *    fades light there.
 * None of them can invent color where the image has none, and none of them changes alpha or level.
 */
export function envelopeChromaticity(rgb: ArrayLike<number>, coverage: Uint8Array, width: number, height: number, bounds: SkyBounds, scalePixels: number,
  halfSaturationQuantile: number = DEFAULT_CHROMA_HALF_SATURATION_QUANTILE, skyQuantile: number = DEFAULT_CHROMA_SKY_QUANTILE,
  coverageTaper: number = DEFAULT_CHROMA_COVERAGE_TAPER) {
  if (!Number.isFinite(halfSaturationQuantile) || halfSaturationQuantile <= 0 || halfSaturationQuantile > 1)
    throw new TypeError('Envelope chroma half-saturation quantile must be in (0,1].');
  if (!Number.isFinite(skyQuantile) || skyQuantile <= 0 || skyQuantile > 1)
    throw new TypeError('Envelope chroma sky quantile must be in (0,1].');
  if (!Number.isFinite(coverageTaper) || coverageTaper < 0 || coverageTaper >= 1)
    throw new TypeError('Envelope chroma coverage taper must be in [0,1).');
  const n = width * height, chroma = new Float32Array(n * 3), weight = blurWeighted(new Float32Array(n).fill(1), coverage, width, height, scalePixels);
  // The authored per-channel sky level of the observed pixels is removed first (the median by default);
  // otherwise faint regions take the sky's tint.
  const sky = [0, 1, 2].map(c => { const v: number[] = []; for (let p = 0; p < n; p++) if (coverage[p]) v.push(rgb[p * 3 + c]!); v.sort((a, b) => a - b);
    return v.length ? v[Math.min(v.length - 1, Math.floor(v.length * skyQuantile))]! : 0; });
  const channels = [0, 1, 2].map(c => blurWeighted(Float32Array.from({ length: n }, (_, p) => Math.max(0, rgb[p * 3 + c]! - sky[c]!)), coverage, width, height, scalePixels));
  const signal = new Float64Array(n);
  for (let p = 0; p < n; p++) signal[p] = weight[p]! > 1e-6 ? Math.max(channels[0]![p]!, channels[1]![p]!, channels[2]![p]!) / weight[p]! : 0;
  const observed = Array.from(signal).filter((_, p) => coverage[p] && signal[p]! > 0).sort((a, b) => a - b);
  const halfSaturation = observed.length ? observed[Math.min(observed.length - 1, Math.floor(observed.length * halfSaturationQuantile))]! : 1;
  // The footprint-edge taper reads the same blurred coverage fraction the gain tapers on, so color and
  // light fade out together instead of a tapered gain carrying a full-strength extrapolated color.
  const blurredOnes = coverageTaper > 0 ? blurWeighted(new Float32Array(n).fill(1), new Float32Array(n).fill(1), width, height, scalePixels) : null;
  for (let p = 0; p < n; p++) {
    const values = channels.map(channel => weight[p]! > 1e-6 ? channel[p]! / weight[p]! : 0), peak = Math.max(...values);
    // Faint light is increasingly neutral: its color is dominated by noise and residual sky, not the galaxy.
    let trust = signal[p]! / (signal[p]! + halfSaturation);
    if (blurredOnes) {
      const inside = blurredOnes[p]! > 0 ? weight[p]! / blurredOnes[p]! : 0;
      trust *= Math.min(1, Math.max(0, (inside - coverageTaper) / coverageTaper));
    }
    for (let c = 0; c < 3; c++) chroma[p * 3 + c] = peak > 0 ? 255 * (1 - trust) + trust * 255 * values[c]! / peak : 255;
  }
  const grid = { width, height, bounds }, scratch = [0, 0, 0];
  return (x: number, y: number, out: [number, number, number]): boolean => {
    if (!sampleEnvelopeGrid(grid, chroma, 3, x, y, scratch)) return false;
    for (let c = 0; c < 3; c++) out[c] = Math.min(255, Math.max(0, scratch[c]!));
    return true;
  };
}
