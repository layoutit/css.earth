/** Relative display-signal comparison. Geometry and material are never fitted per image ray. */
import { type Bounds3, shapePixelToUnits } from '@cssearth/bake/volume';
import { blur, displayLuminance } from '@cssearth/nebula-reconstruction/evidence/geometry/ridges';

export interface NeutralProjection { alpha: Float32Array; width: number; height: number; bounds: Bounds3 }
function dimensions(width: number, height: number) {
  if (!Number.isInteger(width) || !Number.isInteger(height) || width < 1 || height < 1 || width * height > 1_000_000)
    throw new TypeError('Structure comparison requires a bounded complete image grid.');
}

/** Place the actual baked neutral Z projection into the original full photograph grid. */
export function registeredNeutralProjection(projection: NeutralProjection | undefined, width: number, height: number): Float32Array {
  dimensions(width, height);
  const output = new Float32Array(width * height);
  if (!projection) return output;
  dimensions(projection.width, projection.height);
  const { bounds, alpha, width: sw, height: sh } = projection;
  if (alpha.length !== sw * sh || alpha.some(value => !Number.isFinite(value) || value < 0 || value > 1) ||
      bounds.min.some((value, axis) => !Number.isFinite(value) || !Number.isFinite(bounds.max[axis]) || value >= bounds.max[axis]!))
    throw new TypeError('Invalid neutral projection or physical bounds.');
  const sample = (x: number, y: number) => x < 0 || x >= sw || y < 0 || y >= sh ? 0 : alpha[y * sw + x]!;
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
    const [px, py] = shapePixelToUnits(x + .5, y + .5, width, height);
    const u = (px - bounds.min[0]) / (bounds.max[0] - bounds.min[0]) * sw - .5;
    const v = (bounds.max[1] - py) / (bounds.max[1] - bounds.min[1]) * sh - .5;
    const ix = Math.floor(u), iy = Math.floor(v), tx = u - ix, ty = v - iy;
    output[y * width + x] = (sample(ix, iy) * (1 - tx) + sample(ix + 1, iy) * tx) * (1 - ty) +
      (sample(ix, iy + 1) * (1 - tx) + sample(ix + 1, iy + 1) * tx) * ty;
  }
  return output;
}

function percentile(values: Float32Array, fraction: number) {
  const sorted = values.slice().sort();
  return sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * fraction))]!;
}
function edges(values: Float32Array, width: number, height: number) {
  const smooth = blur(values, width, height, Math.max(1, width / 384)), gradient = new Float32Array(values.length);
  // No artificial crop-edge gradients. These are 2D slopes, never inferred relief/depth.
  for (let y = 1; y < height - 1; y++) for (let x = 1; x < width - 1; x++) {
    const p = y * width + x;
    gradient[p] = Math.hypot(smooth[p + 1]! - smooth[p - 1]!, smooth[p + width]! - smooth[p - width]!) / 2;
  }
  return gradient;
}

export function compareShapeSignal(rgb: Uint8Array, width: number, height: number, projection?: NeutralProjection) {
  dimensions(width, height);
  const source = displayLuminance(rgb, width, height), neutral = registeredNeutralProjection(projection, width, height);
  let cross = 0, modelPower = 0, sourcePower = 0, sourceSum = 0;
  for (let p = 0; p < source.length; p++) {
    cross += source[p]! * neutral[p]!; modelPower += neutral[p]! ** 2;
    sourcePower += source[p]! ** 2; sourceSum += source[p]!;
  }
  // A single global amplitude is unidentifiable in an uncalibrated display model.
  // Fit it once; preserve every spatial discrepancy and all unmodeled outer signal.
  const brightnessScale = modelPower > 0 ? cross / modelPower : 0;
  const model = Float32Array.from(neutral, value => value * brightnessScale), difference = new Float32Array(source.length);
  let missing = 0, excess = 0, squaredError = 0;
  for (let p = 0; p < source.length; p++) {
    const delta = source[p]! - model[p]!; difference[p] = delta;
    missing += Math.max(0, delta); excess += Math.max(0, -delta); squaredError += delta * delta;
  }
  const sourceEdges = edges(source, width, height), modelEdges = edges(model, width, height);
  return { width, height, source, model, sourceEdges, modelEdges, difference, brightnessScale,
    whiteLevel: Math.max(1 / 255, percentile(source, .995)), edgeWhiteLevel: Math.max(1e-6, percentile(sourceEdges, .995)),
    metrics: { missingFraction: sourceSum ? missing / sourceSum : 0, excessFraction: sourceSum ? excess / sourceSum : 0,
      normalizedRmse: sourcePower ? Math.sqrt(squaredError / sourcePower) : 0 },
  };
}

/** Same source-derived level on both sides. Midgray in a signed residual means equal signal. */
export function comparisonPixels(values: Float32Array, whiteLevel: number, gain: number, signed = false): Buffer {
  if (!Number.isFinite(whiteLevel) || whiteLevel <= 0 || !Number.isFinite(gain) || gain <= 0)
    throw new TypeError('Invalid shared comparison display levels.');
  const bytes = Buffer.alloc(values.length);
  for (let p = 0; p < values.length; p++) {
    if (!Number.isFinite(values[p])) throw new TypeError('Comparison signal must be finite.');
    const value = values[p]! * gain / whiteLevel;
    bytes[p] = signed ? Math.round(128 + 127 * Math.max(-1, Math.min(1, value))) : Math.round(255 * Math.max(0, Math.min(1, value)));
  }
  return bytes;
}
