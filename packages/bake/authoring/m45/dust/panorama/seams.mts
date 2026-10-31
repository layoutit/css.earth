import { SKY_BASES, type SkyBasis } from '@cssearth/bake/sky';
import { partitionAlpha } from '../geometry/windows.mts';

export type Direction = readonly [number, number, number];
export interface FacePixels { basis: SkyBasis; size: number; rgba: Uint8Array }
export type Pixel = readonly [number, number, number, number];
const dot = (a: Direction, b: Direction) => a.reduce((sum, value, i) => sum + value * b[i]!, 0);
const clamp = (value: number, low: number, high: number) => Math.max(low, Math.min(high, value));

/** A fixed angular partition of one panorama. A full native texel is transparent
 * before each expanded geometric edge, so raster AA cannot clip nonzero light. */
export function faceWeights(direction: Direction, size: number, gutter: number): Float64Array {
  if (!Number.isInteger(size) || size < 4 || !Number.isInteger(gutter) || gutter < 2 || !direction.every(Number.isFinite)) throw new Error('Finite ray and positive guarded cube dimensions required');
  const maximum = Math.max(...direction.map(Math.abs));
  if (!(maximum > 0)) throw new Error('Nonzero panorama ray required');
  const support = 1 + 2 * (gutter - 1) / size, threshold = 1 / support;
  const weights = Float64Array.from(SKY_BASES, basis => {
    const t = clamp((dot(direction, basis.forwardIcrf) / maximum - threshold) / (1 - threshold), 0, 1);
    return t * t * (3 - 2 * t);
  });
  const total = weights.reduce((sum, value) => sum + value, 0);
  return weights.map(value => value / total);
}

/** Bilinear source-over display values, clamped to this measured face's last
 * sample. The common cross-face interpolation below is identical for all copies. */
function sampleFace(face: FacePixels, direction: Direction): Pixel {
  const depth = dot(direction, face.basis.forwardIcrf), n = face.size;
  const x = clamp((dot(direction, face.basis.rightIcrf) / depth + 1) * n / 2 - .5, 0, n - 1);
  const y = clamp((1 - dot(direction, face.basis.upIcrf) / depth) * n / 2 - .5, 0, n - 1);
  const ix = Math.floor(x), iy = Math.floor(y), u = x - ix, v = y - iy, result = [0, 0, 0, 0];
  for (let j = 0; j < 2; j++) for (let i = 0; i < 2; i++) {
    const offset = (Math.min(iy + j, n - 1) * n + Math.min(ix + i, n - 1)) * 4;
    const alpha = face.rgba[offset + 3]! / 255, weight = (i ? u : 1 - u) * (j ? v : 1 - v);
    result[3]! += alpha * weight;
    for (let c = 0; c < 3; c++) result[c]! += face.rgba[offset + c]! / 255 * alpha * weight;
  }
  return [result[0]!, result[1]!, result[2]!, result[3]!];
}

/** One continuous prepared angular image; interpolation changes only the narrow
 * face-edge overlap. RGB is the existing display RGB, not a new physical fit. */
export function samplePanorama(faces: readonly FacePixels[], direction: Direction, weights: Float64Array): Pixel {
  const result = [0, 0, 0, 0];
  for (const [i, face] of faces.entries()) if (weights[i]! > 0) {
    const pixel = sampleFace(face, direction);
    for (let c = 0; c < 4; c++) result[c]! += weights[i]! * pixel[c]!;
  }
  return [result[3] ? result[0]! / result[3] : 0, result[3] ? result[1]! / result[3] : 0,
    result[3] ? result[2]! / result[3] : 0, result[3]!];
}

/** Joint8bit optical allocation: the strongest face carries residual
 * transmission, bounding source-over alpha error to half one alpha byte. */
export function opticalBytes(alpha: number, weights: Float64Array): Uint8Array {
  if (!(alpha >= 0 && alpha <= 1) || weights.some(weight => !(weight >= 0 && weight <= 1)) || Math.abs(weights.reduce((sum, value) => sum + value, 0) - 1) > 1e-10) throw new Error('Normalized finite optical partition required');
  let anchor = 0;
  weights.forEach((weight, i) => { if (weight > weights[anchor]!) anchor = i; });
  const bytes = new Uint8Array(weights.length);
  if (alpha === 1) { bytes[anchor] = 255; return bytes; }
  let transmitted = 1;
  weights.forEach((weight, i) => { if (i !== anchor) { bytes[i] = Math.floor(255 * partitionAlpha(alpha, weight) + 1e-12); transmitted *= 1 - bytes[i]! / 255; } });
  bytes[anchor] = Math.round(255 * clamp(1 - (1 - alpha) / transmitted, 0, 1));
  return bytes;
}

export function guardedPixel(faces: readonly FacePixels[], faceIndex: number, direction: Direction, gutter: number): Pixel {
  const weights = faceWeights(direction, faces[0]!.size, gutter);
  if (!weights[faceIndex]) return [0, 0, 0, 0];
  const common = samplePanorama(faces, direction, weights), bytes = opticalBytes(common[3], weights);
  return [Math.round(255 * common[0]), Math.round(255 * common[1]), Math.round(255 * common[2]), bytes[faceIndex]!];
}
