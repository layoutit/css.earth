/** Low-frequency emission that keeps the simulation's own 3D density shape, scaled per sky position to the image. */
import type { SkyBounds } from '@cssearth/volume-core/contracts/emission';
import type { SimulationDepthPrior } from './simulation-guided.ts';

export interface SimulationEnvelopeSettings {
  /** Gaussian sigma, in fit pixels, of the sky-plane smoothing that separates envelope from detail. */
  scalePixels: number;
  /** Share of the smoothed image assigned to the simulation envelope; the rest is left for finite detail. */
  fraction: number;
  /** Minimum gain, as a share of the global image/simulation ratio, wherever the simulation has density. Zero adds no unobserved light. */
  floor: number;
  depthSamples: number;
  /** Image-weighted simulation mass trimmed from each end of the depth range (0.005 keeps 99%). */
  depthTrim: number;
}
export interface SimulationEnvelopeGrid {
  width: number; height: number; bounds: SkyBounds; zRange: [number, number];
  /** Row-major gain per fit pixel (top row first, like the image). */
  gain: Float32Array;
}
export interface SimulationEnvelopeFit {
  grid: SimulationEnvelopeGrid;
  /** Simulation column density per pixel, integrated along field z. */
  columns: Float32Array;
  /** gain × columns: the envelope's own front projection. */
  projection: Float32Array;
  metrics: { globalRatio: number; envelopeLightFraction: number; excessLightFraction: number; floorPixels: number };
}

export function validateEnvelopeSettings(value: unknown): SimulationEnvelopeSettings {
  if (!value || typeof value !== 'object') throw new TypeError('Envelope settings must be an object.');
  const s = value as Record<string, unknown>;
  const { scalePixels, fraction, floor, depthSamples, depthTrim } = s;
  if (typeof scalePixels !== 'number' || !Number.isFinite(scalePixels) || scalePixels < .5 || scalePixels > 128 ||
    typeof fraction !== 'number' || !Number.isFinite(fraction) || fraction < 0 || fraction > 1 ||
    typeof floor !== 'number' || !Number.isFinite(floor) || floor < 0 || floor > 1 ||
    typeof depthSamples !== 'number' || !Number.isInteger(depthSamples) || depthSamples < 8 || depthSamples > 4096 ||
    typeof depthTrim !== 'number' || !Number.isFinite(depthTrim) || depthTrim < 0 || depthTrim >= .25)
    throw new TypeError('Invalid simulation envelope settings.');
  return { scalePixels, fraction, floor, depthSamples, depthTrim };
}

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

const pixelCenter = (bounds: SkyBounds, width: number, height: number, p: number): [number, number] => [
  bounds.min[0] + (p % width + .5) * (bounds.max[0] - bounds.min[0]) / width,
  bounds.max[1] - (Math.floor(p / width) + .5) * (bounds.max[1] - bounds.min[1]) / height,
];

/** Gain = fraction × blur(image) / blur(simulation columns). Depth always comes from the simulation, never the image. */
export function fitSimulationEnvelope(input: { target: Float32Array; coverage: Uint8Array; width: number; height: number; bounds: SkyBounds },
  prior: SimulationDepthPrior, settings: SimulationEnvelopeSettings, signal?: AbortSignal): SimulationEnvelopeFit {
  const { target, coverage, width, height, bounds } = input, n = width * height;
  if (target.length !== n || coverage.length !== n) throw new TypeError('Envelope target and coverage must match the fit grid.');
  const inPrior = (x: number, y: number) => x >= prior.bounds.min[0] && x <= prior.bounds.max[0] && y >= prior.bounds.min[1] && y <= prior.bounds.max[1];
  // Depth extent: trim the image-weighted simulation mass so a long faint tail does not dilate slab resolution.
  const fullSteps = settings.depthSamples, fullDz = (prior.bounds.max[2] - prior.bounds.min[2]) / fullSteps, profile = new Float64Array(fullSteps);
  for (let p = 0; p < n; p += 3) {
    if (!coverage[p] || !(target[p]! > 0)) continue;
    const [x, y] = pixelCenter(bounds, width, height, p); if (!inPrior(x, y)) continue;
    for (let i = 0; i < fullSteps; i++) profile[i] += target[p]! * prior.sampleDensity(x, y, prior.bounds.min[2] + (i + .5) * fullDz);
  }
  const profileMass = profile.reduce((a, b) => a + b, 0);
  let first = 0, last = fullSteps - 1;
  if (profileMass > 0) {
    for (let acc = 0; first < fullSteps; first++) { acc += profile[first]!; if (acc > settings.depthTrim * profileMass) break; }
    for (let acc = 0; last > first; last--) { acc += profile[last]!; if (acc > settings.depthTrim * profileMass) break; }
  }
  const zRange: [number, number] = [prior.bounds.min[2] + first * fullDz, prior.bounds.min[2] + (last + 1) * fullDz];
  const steps = settings.depthSamples, dz = (zRange[1] - zRange[0]) / steps;
  const columns = new Float32Array(n);
  for (let p = 0; p < n; p++) {
    if (p % width === 0) signal?.throwIfAborted();
    const [x, y] = pixelCenter(bounds, width, height, p);
    if (!inPrior(x, y)) continue;
    let sum = 0;
    for (let i = 0; i < steps; i++) {
      const density = prior.sampleDensity(x, y, zRange[0] + (i + .5) * dz);
      if (!Number.isFinite(density) || density < 0) throw new Error('Prior returned invalid density');
      sum += density;
    }
    columns[p] = sum * dz;
  }
  const ones = new Float32Array(n).fill(1);
  const blurredTarget = blurWeighted(target, coverage, width, height, settings.scalePixels), blurredCoverage = blurWeighted(ones, coverage, width, height, settings.scalePixels);
  const blurredOnes = blurWeighted(ones, ones, width, height, settings.scalePixels);
  const blurredColumns = blurWeighted(columns, ones, width, height, settings.scalePixels).map((v, p) => v / blurredOnes[p]!);
  let targetSum = 0, columnSum = 0;
  for (let p = 0; p < n; p++) if (coverage[p]) { targetSum += target[p]!; columnSum += columns[p]!; }
  const globalRatio = columnSum > 0 ? targetSum / columnSum : 0;
  const peakColumn = blurredColumns.reduce((a, b) => Math.max(a, b), 0), epsilon = 1e-3 * peakColumn;
  const gain = new Float32Array(n), projection = new Float32Array(n);
  let envelopeLight = 0, excessLight = 0, floorPixels = 0;
  for (let p = 0; p < n; p++) {
    const smoothTarget = blurredCoverage[p]! > 1e-6 ? blurredTarget[p]! / blurredCoverage[p]! : 0;
    let g = blurredColumns[p]! > epsilon ? settings.fraction * smoothTarget / blurredColumns[p]! : 0;
    if (columns[p]! > 0 && g < settings.floor * globalRatio) { g = settings.floor * globalRatio; floorPixels++; }
    // Taper to zero across the observed footprint edge: unobserved sky must not end in a hard straight cut.
    const inside = blurredOnes[p]! > 0 ? blurredCoverage[p]! / blurredOnes[p]! : 0;
    g *= Math.min(1, Math.max(0, (inside - .5) * 2));
    gain[p] = g; projection[p] = g * columns[p]!;
    if (coverage[p]) { envelopeLight += projection[p]!; excessLight += Math.max(0, projection[p]! - target[p]!); }
  }
  return { grid: { width, height, bounds, zRange, gain }, columns, projection,
    metrics: { globalRatio, envelopeLightFraction: targetSum > 0 ? envelopeLight / targetSum : 0, excessLightFraction: targetSum > 0 ? excessLight / targetSum : 0, floorPixels } };
}

/** Bilinear lookup in a row-major sky grid; false outside the grid. */
function sampleGrid(grid: { width: number; height: number; bounds: SkyBounds }, values: ArrayLike<number>, channels: number, x: number, y: number, out: number[]): boolean {
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
    if (z < grid.zRange[0] || z > grid.zRange[1] || !sampleGrid(grid, grid.gain, 1, x, y, scratch) || !(scratch[0]! > 0)) return 0;
    return scratch[0]! * prior.sampleDensity(x, y, z);
  };
}

/** Smoothed, peak-normalized chromaticity of one registered image at envelope scale; neutral where unobserved or black. */
export function envelopeChromaticity(rgb: ArrayLike<number>, coverage: Uint8Array, width: number, height: number, bounds: SkyBounds, scalePixels: number) {
  const n = width * height, chroma = new Float32Array(n * 3), weight = blurWeighted(new Float32Array(n).fill(1), coverage, width, height, scalePixels);
  // Per-channel sky level (median of observed pixels) is removed first; otherwise faint regions take the sky's tint.
  const sky = [0, 1, 2].map(c => { const v: number[] = []; for (let p = 0; p < n; p++) if (coverage[p]) v.push(rgb[p * 3 + c]!); v.sort((a, b) => a - b); return v.length ? v[v.length >> 1]! : 0; });
  const channels = [0, 1, 2].map(c => blurWeighted(Float32Array.from({ length: n }, (_, p) => Math.max(0, rgb[p * 3 + c]! - sky[c]!)), coverage, width, height, scalePixels));
  const signal = new Float64Array(n);
  for (let p = 0; p < n; p++) signal[p] = weight[p]! > 1e-6 ? Math.max(channels[0]![p]!, channels[1]![p]!, channels[2]![p]!) / weight[p]! : 0;
  const observed = Array.from(signal).filter((_, p) => coverage[p] && signal[p]! > 0).sort((a, b) => a - b), halfSaturation = observed.length ? observed[Math.floor(observed.length * .9)]! : 1;
  for (let p = 0; p < n; p++) {
    const values = channels.map(channel => weight[p]! > 1e-6 ? channel[p]! / weight[p]! : 0), peak = Math.max(...values);
    // Faint light is increasingly neutral: its colour is dominated by noise and residual sky, not the galaxy.
    const trust = signal[p]! / (signal[p]! + halfSaturation);
    for (let c = 0; c < 3; c++) chroma[p * 3 + c] = peak > 0 ? 255 * (1 - trust) + trust * 255 * values[c]! / peak : 255;
  }
  const grid = { width, height, bounds }, scratch = [0, 0, 0];
  return (x: number, y: number, out: [number, number, number]): boolean => {
    if (!sampleGrid(grid, chroma, 3, x, y, scratch)) return false;
    for (let c = 0; c < 3; c++) out[c] = Math.min(255, Math.max(0, scratch[c]!));
    return true;
  };
}
