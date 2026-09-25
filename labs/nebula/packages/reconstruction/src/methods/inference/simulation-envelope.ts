/**
 * Fitting the low-frequency envelope that keeps the simulation's own 3D density shape.
 *
 * The settings contract, the weighted blur, the pixel-centre mapping and the bake-time samplers now belong
 * to `@cssearth/bake/volume`, so replay can use them without the fitting methods. They are re-exported here unchanged
 * for existing consumers; the arithmetic and coordinate conventions are identical.
 */
import { type SkyBounds, type SimulationDepthPrior, blurWeighted, pixelCenter, validateEnvelopeSettings, type SimulationEnvelopeGrid, type SimulationEnvelopeSettings } from '@cssearth/bake/volume';

export { blurWeighted, createEnvelopeSampler, DEFAULT_CHROMA_COVERAGE_TAPER, DEFAULT_CHROMA_HALF_SATURATION_QUANTILE,
  DEFAULT_CHROMA_SKY_QUANTILE, envelopeChromaSettings, envelopeChromaticity, pixelCenter, validateEnvelopeSettings } from '@cssearth/bake/volume';
export type { SimulationEnvelopeGrid, SimulationEnvelopeSettings } from '@cssearth/bake/volume';

export interface SimulationEnvelopeFit {
  grid: SimulationEnvelopeGrid;
  /** Simulation column density per pixel, integrated along field z. */
  columns: Float32Array;
  /** gain × columns: the envelope's own front projection. */
  projection: Float32Array;
  metrics: { globalRatio: number; envelopeLightFraction: number; excessLightFraction: number; floorPixels: number };
}

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
