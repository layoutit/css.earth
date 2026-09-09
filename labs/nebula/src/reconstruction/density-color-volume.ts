/** Offline color projection onto an unchanged physical density volume. */
import { sampleEncoded, type VolumeSource } from '../../../../src/preparation/volume/source.js';
import { channelDensity } from '../../../../src/preparation/volume/slices.js';
import type { ObservationMapping } from '../density/observation-prior.js';
import type { ObservationPhoto } from './filled-products.js';

type Vec3 = [number, number, number];
/** Native image UV, top-left origin. Write display RGB in [0,255]; false means no data. */
export type SampleImageRgb = (u: number, v: number, out: Vec3) => boolean | void;

export interface DensityColorVolumeOptions {
  source: VolumeSource;
  mapping: ObservationMapping;
  /** A rectified, north-up image over mapping.boundsUnits, before the display-only east-left flip. */
  photo?: Pick<ObservationPhoto, 'width' | 'height' | 'rgb'>;
  /** Alternative to a rectified photo; samples the original registered image UV. */
  sampleImageRgb?: SampleImageRgb;
  /** One source-independent multiplier per physical kpc. Unity matches the neutral density recipe. */
  densityScale?: number;
}

/**
 * Density owns every depth and support value; image RGB can only color/dim existing density.
 * No image column normalization, image-derived thickness, density floor or synthesized coverage.
 * The source grid uses kpc. Exposure belongs to the later shared-opacity slice integrator.
 */
export function createDensityColorVolumeSampler(options: DensityColorVolumeOptions) {
  const { source, mapping, photo, sampleImageRgb } = options;
  if (Boolean(photo) === Boolean(sampleImageRgb)) throw new TypeError('Supply exactly one density color image provider.');
  const densityScale = options.densityScale ?? 1;
  if (!Number.isFinite(densityScale) || densityScale <= 0) throw new TypeError('Density scale must be finite and positive.');
  if (photo && (!Number.isInteger(photo.width) || !Number.isInteger(photo.height) || photo.width < 1 || photo.height < 1 ||
      photo.rgb.length !== photo.width * photo.height * 3)) throw new TypeError('Rectified density color image requires complete RGB pixels.');
  const supportBoundsKpc = { min: [...source.recipe.grid.bounds.min] as Vec3, max: [...source.recipe.grid.bounds.max] as Vec3 };
  if (supportBoundsKpc.min.some((value, i) => !Number.isFinite(value) || !Number.isFinite(supportBoundsKpc.max[i]) ||
      value >= supportBoundsKpc.max[i])) throw new TypeError('Density support must have finite increasing bounds.');
  if (!Number.isFinite(mapping.distanceUnits) || mapping.distanceUnits <= 0 || supportBoundsKpc.min[2] <= -mapping.distanceUnits)
    throw new TypeError('Density support must lie in front of the image observer.');
  const { min, max } = mapping.boundsUnits;
  if (min.some((value, i) => !Number.isFinite(value) || !Number.isFinite(max[i]) || value >= max[i]))
    throw new TypeError('Image tangent bounds must be finite increasing intervals.');
  const encoded: [number, number, number, number] = [0, 0, 0, 0], color: Vec3 = [0, 0, 0];

  function sampleRectified(x: number, y: number): boolean {
    if (!photo || x < min[0] || x > max[0] || y < min[1] || y > max[1]) return false;
    const px = Math.max(0, Math.min(photo.width - 1, (x - min[0]) / (max[0] - min[0]) * photo.width - .5));
    const py = Math.max(0, Math.min(photo.height - 1, (max[1] - y) / (max[1] - min[1]) * photo.height - .5));
    const x0 = Math.floor(px), y0 = Math.floor(py), x1 = Math.min(x0 + 1, photo.width - 1), y1 = Math.min(y0 + 1, photo.height - 1);
    const tx = px - x0, ty = py - y0;
    for (let c = 0; c < 3; c++) {
      const a = photo.rgb[(y0 * photo.width + x0) * 3 + c]!, b = photo.rgb[(y0 * photo.width + x1) * 3 + c]!;
      const d = photo.rgb[(y1 * photo.width + x0) * 3 + c]!, e = photo.rgb[(y1 * photo.width + x1) * 3 + c]!;
      color[c] = (a * (1 - tx) + b * tx) * (1 - ty) + (d * (1 - tx) + e * tx) * ty;
    }
    return true;
  }

  function sample(x: number, y: number, z: number, out: Vec3): void {
    out[0] = out[1] = out[2] = 0;
    if (!Number.isFinite(x) || !Number.isFinite(y) || !Number.isFinite(z)) return;
    sampleEncoded(source, x, y, z, encoded);
    const density = channelDensity(encoded[3], source.recipe.grid.encoding) * densityScale;
    if (!(density > 0)) return;
    const [tx, ty] = mapping.tangentAtPoint(x, y, z), uv = mapping.uvAtTangent(tx, ty);
    if (!uv || !Number.isFinite(uv[0]) || !Number.isFinite(uv[1]) || uv[0] < 0 || uv[0] > 1 || uv[1] < 0 || uv[1] > 1) return;
    color[0] = color[1] = color[2] = 0;
    if (photo ? !sampleRectified(tx, ty) : sampleImageRgb!(uv[0], uv[1], color) === false) return;
    for (let c = 0; c < 3; c++) {
      if (!Number.isFinite(color[c]) || color[c] < 0 || color[c] > 255)
        throw new TypeError('Density color image samples must be finite RGB in [0,255].');
      out[c] = density * color[c] / 255;
    }
  }

  return { sample, supportBoundsKpc, diagnostics: {
    method: 'unchanged-density-times-projected-image-rgb', densityScale,
    densityChannel: 3, densityEncoding: source.recipe.grid.encoding,
    normalization: 'One fixed global scale; no column, image or depth normalization.',
    coverage: 'No emission outside density support or the registered image footprint; no-data remains uncolored.',
    limitation: 'Projected display color on simulated stellar density is a visualization hypothesis, not measured gas or dust geometry.',
  } };
}
