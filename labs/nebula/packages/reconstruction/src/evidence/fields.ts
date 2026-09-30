import type { Affine as Matrix } from '../registration/affine.ts';
import type { EvidenceGrid, EvidencePlane } from './model.ts';

function validateRaster(width: number, height: number, values: ArrayLike<number>, channels = 1) {
  if (!Number.isInteger(width) || !Number.isInteger(height) || width < 1 || height < 1 || width * height > 2_000_000 || values.length !== width * height * channels)
    throw new TypeError('Evidence raster dimensions exceed the bounded working grid.');
}
export function validateMatrix(matrix: Matrix): void {
  if (!Array.isArray(matrix) || matrix.length !== 6 || !matrix.every(Number.isFinite) || Math.abs(matrix[0] * matrix[3] - matrix[1] * matrix[2]) < 1e-12)
    throw new TypeError('Invalid invertible registered transform.');
}
/** Pixel centers use the same image-edge transform as Alignment's retained image. */
export function registerEvidenceRaster(rgba: Uint8Array, width: number, height: number, nativeWidth: number, nativeHeight: number,
  matrix: Matrix, grid: EvidenceGrid) {
  validateRaster(width, height, rgba, 4); validateMatrix(matrix);
  const [a, b, c, d, e, f] = matrix, determinant = a * d - b * c;
  const registeredRgba = new Uint8Array(grid.width * grid.height * 4), footprint = new Uint8Array(grid.width * grid.height);
  const luminance = new Float32Array(footprint.length);
  for (let y = 0; y < grid.height; y++) for (let x = 0; x < grid.width; x++) {
    const fx = grid.originX + (x + .5) * grid.extentWidth / grid.width - e;
    const fy = grid.originY + (y + .5) * grid.extentHeight / grid.height - f;
    const nx = (d * fx - c * fy) / determinant, ny = (-b * fx + a * fy) / determinant;
    if (nx < 0 || ny < 0 || nx >= nativeWidth || ny >= nativeHeight) continue;
    const sx = Math.max(0, Math.min(width - 1, nx * width / nativeWidth - .5));
    const sy = Math.max(0, Math.min(height - 1, ny * height / nativeHeight - .5));
    const x0 = Math.floor(sx), y0 = Math.floor(sy), x1 = Math.min(width - 1, x0 + 1), y1 = Math.min(height - 1, y0 + 1);
    const tx = sx - x0, ty = sy - y0;
    const samples = [y0 * width + x0, y0 * width + x1, y1 * width + x0, y1 * width + x1];
    // No RGB or evidence is interpolated across alpha/no-data holes.
    if (samples.some(index => rgba[index * 4 + 3] < 255)) continue;
    const p = y * grid.width + x; footprint[p] = 1; registeredRgba[p * 4 + 3] = 255;
    for (let channel = 0; channel < 3; channel++) {
      const top = rgba[samples[0] * 4 + channel] * (1 - tx) + rgba[samples[1] * 4 + channel] * tx;
      const bottom = rgba[samples[2] * 4 + channel] * (1 - tx) + rgba[samples[3] * 4 + channel] * tx;
      registeredRgba[p * 4 + channel] = Math.round(top * (1 - ty) + bottom * ty);
      luminance[p] += (top * (1 - ty) + bottom * ty) / 255 * [.2126, .7152, .0722][channel];
    }
  }
  return { registeredRgba, footprint, luminance };
}

/** Three box passes approximate a Gaussian; running sums keep wide scales bounded. */
function box(source: Float32Array, width: number, height: number, radius: number, horizontal: boolean): Float32Array<ArrayBuffer> {
  const output = new Float32Array(source.length), length = horizontal ? width : height, lines = horizontal ? height : width;
  const stride = horizontal ? 1 : width;
  for (let line = 0; line < lines; line++) {
    const offset = horizontal ? line * width : line; let sum = 0;
    for (let k = 0; k <= Math.min(radius, length - 1); k++) sum += source[offset + k * stride];
    for (let k = 0; k < length; k++) {
      output[offset + k * stride] = sum / (radius * 2 + 1);
      if (k - radius >= 0) sum -= source[offset + (k - radius) * stride];
      if (k + radius + 1 < length) sum += source[offset + (k + radius + 1) * stride];
    }
  }
  return output;
}
function radiiForSigma(sigma: number): number[] {
  if (sigma <= .35) return [];
  const ideal = Math.sqrt(4 * sigma * sigma + 1);
  let lower = Math.floor(ideal); if (lower % 2 === 0) lower--;
  const upper = lower + 2;
  const lowerCount = Math.max(0, Math.min(3, Math.round((12 * sigma * sigma - 3 * lower * lower - 12 * lower - 9) / (-4 * lower - 4))));
  return Array.from({ length: 3 }, (_, i) => ((i < lowerCount ? lower : upper) - 1) / 2).filter(r => r > 0);
}
/** Distance to uncovered pixels, including the outer grid edge (Chebyshev metric). */
function interiorDistance(mask: Uint8Array, width: number, height: number): Uint16Array {
  const d = new Uint16Array(mask.length);
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
    const p = y * width + x;
    if (mask[p]) d[p] = x === 0 || y === 0 ? 1 : 1 + Math.min(d[p - 1], d[p - width], d[p - width - 1], x + 1 < width ? d[p - width + 1] : 0);
  }
  for (let y = height - 1; y >= 0; y--) for (let x = width - 1; x >= 0; x--) {
    const p = y * width + x;
    if (mask[p]) d[p] = Math.min(d[p], x === width - 1 || y === height - 1 ? 1 : 1 + Math.min(d[p + 1], d[p + width], d[p + width + 1], x ? d[p + width - 1] : 0));
  }
  return d;
}
function smooth(source: Float32Array, mask: Uint8Array, width: number, height: number, sigma: number) {
  let numerator = Float32Array.from(source, (v, i) => mask[i] ? v : 0), denominator = Float32Array.from(mask);
  const radii = radiiForSigma(sigma);
  for (const radius of radii) for (const horizontal of [true, false]) {
    numerator = box(numerator, width, height, radius, horizontal);
    denominator = box(denominator, width, height, radius, horizontal);
  }
  for (let p = 0; p < numerator.length; p++) numerator[p] = denominator[p] > 1e-6 ? numerator[p] / denominator[p] : 0;
  return { values: numerator, radius: radii.reduce((a, b) => a + b, 0) };
}
function percentile(values: number[], fraction: number): number {
  if (!values.length) return 0; values.sort((a, b) => a - b); return values[Math.floor((values.length - 1) * fraction)];
}
function samples(values: Float32Array, mask: Uint8Array): number[] {
  const result: number[] = [], step = Math.max(1, Math.floor(values.length / 16000));
  for (let p = 0; p < values.length; p += step) if (mask[p]) result.push(values[p]);
  return result;
}
function noiseProxy(signed: Float32Array, mask: Uint8Array, floor: number): number {
  const values = samples(signed, mask), negative = values.filter(v => v < 0).map(v => -v);
  const estimate = negative.length > 16 ? percentile(negative, .5) / .67448975 : (() => {
    const center = percentile([...values], .5); return percentile(values.map(v => Math.abs(v - center)), .5) / .67448975;
  })();
  return Math.max(1e-9, floor, estimate);
}
function emptyPlane(length: number): EvidencePlane { return { signal: new Float32Array(length), coverage: new Uint8Array(length), noiseSigma: 0 }; }

/** Shared angular scales, corrected for working-pixel blur, never matched RGB flux. */
export function extractEvidenceFields(luminance: Float32Array, footprint: Uint8Array, width: number, height: number,
  targetSigmas: number[], samplingSigma: number) {
  validateRaster(width, height, luminance); validateRaster(width, height, footprint);
  if (luminance.some(v => !Number.isFinite(v)) || targetSigmas.length !== 5 || targetSigmas.some(v => !Number.isFinite(v) || v <= samplingSigma) ||
      !Number.isFinite(samplingSigma) || samplingSigma < 0) throw new TypeError('Invalid common scales or luminance.');
  const distance = interiorDistance(footprint, width, height), length = luminance.length;
  const rawSamples = samples(luminance, footprint), baseline = percentile([...rawSamples], .1);
  const dynamic = Math.max(1e-8, percentile(rawSamples, .99) - baseline);
  // Remove the arbitrary display offset before finite derivatives, avoiding cancellation of large constant backgrounds.
  const normalized = Float32Array.from(luminance, value => (value - baseline) / dynamic);
  const levels = targetSigmas.map(sigma => smooth(normalized, footprint, width, height, Math.sqrt(sigma * sigma - samplingSigma * samplingSigma)));
  const channels = { broad: emptyPlane(length), ridges: emptyPlane(length), compact: emptyPlane(length) };
  const ridgeDirectionX = new Float32Array(length), ridgeDirectionY = new Float32Array(length);
  for (const [channel, pairs] of [['compact', [[0, 1], [1, 2]]], ['broad', [[2, 3], [3, 4]]]] as const) {
    for (const [small, large] of pairs) {
      const signed = new Float32Array(length), coverage = new Uint8Array(length);
      for (let p = 0; p < length; p++) if (distance[p] > levels[large].radius) {
        coverage[p] = 1; signed[p] = levels[small].values[p] - levels[large].values[p];
      }
      const sigma = noiseProxy(signed, coverage, .005), plane = channels[channel];
      plane.noiseSigma = Math.max(plane.noiseSigma, sigma);
      for (let p = 0; p < length; p++) if (coverage[p]) {
        plane.coverage[p] = 1; plane.signal[p] = Math.max(plane.signal[p], signed[p] / sigma);
      }
    }
  }
  for (const scale of [1, 2, 3]) {
    const values = levels[scale].values, signed = new Float32Array(length), response = new Float32Array(length), coverage = new Uint8Array(length);
    const tangentX = new Float32Array(length), tangentY = new Float32Array(length), scaleSquared = targetSigmas[scale] ** 2;
    for (let y = 1; y < height - 1; y++) for (let x = 1; x < width - 1; x++) {
      const p = y * width + x; if (distance[p] <= levels[scale].radius + 1) continue;
      coverage[p] = 1;
      const xx = (values[p - 1] - 2 * values[p] + values[p + 1]) * scaleSquared;
      const yy = (values[p - width] - 2 * values[p] + values[p + width]) * scaleSquared;
      const xy = (values[p + width + 1] - values[p + width - 1] - values[p - width + 1] + values[p - width - 1]) * .25 * scaleSquared;
      const delta = Math.hypot(xx - yy, 2 * xy), lower = (xx + yy - delta) / 2, upper = (xx + yy + delta) / 2;
      signed[p] = -(xx + yy);
      response[p] = Math.max(0, -lower) * Math.max(0, 1 - Math.abs(upper) / Math.max(1e-12, Math.abs(lower)));
      // Largest eigenvalue is the bright ridge's tangent; its sign is irrelevant.
      const angle = .5 * Math.atan2(2 * xy, xx - yy); tangentX[p] = Math.cos(angle); tangentY[p] = Math.sin(angle);
    }
    const sigma = noiseProxy(signed, coverage, .005), plane = channels.ridges;
    plane.noiseSigma = Math.max(plane.noiseSigma, sigma);
    for (let p = 0; p < length; p++) if (coverage[p]) {
      plane.coverage[p] = 1;
      if (response[p] / sigma > plane.signal[p]) { plane.signal[p] = response[p] / sigma; ridgeDirectionX[p] = tangentX[p]; ridgeDirectionY[p] = tangentY[p]; }
    }
  }
  return { channels, ridgeDirectionX, ridgeDirectionY };
}
