/**
 * Register a placed frame against a controlled mosaic of the body, in the frame's own pixels. The mosaic is rendered through
 * the fitted camera into the detector grid, both images are high-passed, and the offset that maximises their correlation is
 * the residual of the limb placement. A body seen pole-on stretches badly onto latitude and longitude, so the comparison is
 * done here, where a pointing error is a plain translation.
 */
import { resolve } from 'node:path';
import { loadIsis3Raster } from '../terrestrial-layers/isis3-raster.mts';
import { sampleScienceGrid, scienceMapPoint } from '../terrestrial-layers/scientific-raster.mts';
import { parseScienceGrid } from '../terrestrial-layers/source-records.mts';
import type { PlacedFrame } from './place.mts';

export interface MosaicReference { reference: 'mosaic'; path: string; grid: unknown }
/** A controlled cylindrical mosaic (an ISIS cube pinned as a lens) as a sampler of positive values by east longitude and latitude. */
export async function mosaicSampler(sourceDirectory: string, reference: MosaicReference) {
  const grid = parseScienceGrid(reference.grid), raster = await loadIsis3Raster(resolve(sourceDirectory, reference.path), reference.grid);
  const scalar = { width: grid.width, height: grid.height, noData: null, specialValueMagnitude: grid.specialValueMagnitude };
  const projection = { referenceRadiusMeters: grid.referenceRadiusMeters, centerLongitude: grid.centerLongitude, longitudeRange: grid.longitudeRange };
  const resolutionMeters = Number((reference.grid as { resolutionMeters?: unknown }).resolutionMeters);
  if (!Number.isFinite(resolutionMeters) || resolutionMeters <= 0) throw new TypeError('A mosaic reference needs its grid resolution in metres.');
  const sample = (longitude: number, latitude: number) => {
    const [x, y] = scienceMapPoint(longitude, latitude, projection);
    const value = sampleScienceGrid(raster.data, scalar, (x - raster.origin[0]!) / raster.resolution[0]! - 0.5, (y - raster.origin[1]!) / raster.resolution[1]! - 0.5);
    return value !== null && Number.isFinite(value) && value > 0 ? value : null;
  };
  return { sample, resolutionMeters };
}

export interface MosaicRegistration { shiftPixels: [number, number]; correlation: number; samples: number; searchPixels: number; highPassPixels: number }
export interface MosaicRegisterPolicy { searchPixels: number; highPassPixels: number; stepDegrees: number; minimumCorrelation: number }
export const MOSAIC_REGISTER_POLICY: MosaicRegisterPolicy = { searchPixels: 30, highPassPixels: 12, stepDegrees: 0.05, minimumCorrelation: 0.2 };
/** The lat/lon step to render at: half a detector pixel of this frame on the surface, never finer than the policy floor. */
export function renderStep(placed: PlacedFrame, radiusKm?: number, policy: MosaicRegisterPolicy = MOSAIC_REGISTER_POLICY) {
  const r = radiusKm ?? placed.radiusKm;
  return Math.max(policy.stepDegrees, placed.pixelScaleKm / (r * Math.PI / 180) / 2);
}

/** The mosaic seen through the placed camera: nearest splat of a lat/lon grid, NaN where nothing lands. */
export function renderMosaicThroughCamera(placed: PlacedFrame, radiusKm: number, mosaic: (longitude: number, latitude: number) => number | null,
  { width, height, stepDegrees, maximumEmissionDegrees }: { width: number; height: number; stepDegrees: number; maximumEmissionDegrees: number }) {
  const { matrix: m, positionKm: obs } = placed.camera, d2r = Math.PI / 180, cosE = Math.cos(maximumEmissionDegrees * d2r);
  const image = new Float32Array(width * height).fill(NaN);
  for (let latitude = -90; latitude <= 90; latitude += stepDegrees) for (let longitude = 0; longitude < 360; longitude += stepDegrees) {
    const n = [Math.cos(latitude * d2r) * Math.cos(longitude * d2r), Math.cos(latitude * d2r) * Math.sin(longitude * d2r), Math.sin(latitude * d2r)], p = n.map(c => c * radiusKm);
    const v = [obs[0]! - p[0]!, obs[1]! - p[1]!, obs[2]! - p[2]!], vn = Math.hypot(v[0]!, v[1]!, v[2]!);
    if ((v[0]! * n[0]! + v[1]! * n[1]! + v[2]! * n[2]!) / vn < cosE) continue;
    const w = m[2]![0]! * p[0]! + m[2]![1]! * p[1]! + m[2]![2]! * p[2]! + m[2]![3]!;
    const x = Math.round((m[0]![0]! * p[0]! + m[0]![1]! * p[1]! + m[0]![2]! * p[2]! + m[0]![3]!) / w), y = Math.round((m[1]![0]! * p[0]! + m[1]![1]! * p[1]! + m[1]![2]! * p[2]! + m[1]![3]!) / w);
    if (x < 0 || y < 0 || x >= width || y >= height) continue;
    const value = mosaic(longitude, latitude);
    if (value !== null) image[y * width + x] = value;
  }
  return image;
}

/** Subtract a box mean of the given half-width, ignoring NaN; NaN where fewer than a quarter of the box is valid. */
export function highPass(values: Float32Array, width: number, height: number, half: number) {
  // Summed-area tables over values and counts give an exact box mean at every pixel.
  const sum = new Float64Array((width + 1) * (height + 1)), count = new Float64Array((width + 1) * (height + 1));
  for (let y = 1; y <= height; y++) for (let x = 1; x <= width; x++) {
    const v = values[(y - 1) * width + (x - 1)]!, ok = Number.isFinite(v);
    sum[y * (width + 1) + x] = (ok ? v : 0) + sum[(y - 1) * (width + 1) + x]! + sum[y * (width + 1) + x - 1]! - sum[(y - 1) * (width + 1) + x - 1]!;
    count[y * (width + 1) + x] = (ok ? 1 : 0) + count[(y - 1) * (width + 1) + x]! + count[y * (width + 1) + x - 1]! - count[(y - 1) * (width + 1) + x - 1]!;
  }
  const out = new Float32Array(width * height).fill(NaN);
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
    const v = values[y * width + x]!; if (!Number.isFinite(v)) continue;
    const x0 = Math.max(0, x - half), x1 = Math.min(width, x + half + 1), y0 = Math.max(0, y - half), y1 = Math.min(height, y + half + 1);
    const at = (yy: number, xx: number) => yy * (width + 1) + xx;
    const s = sum[at(y1, x1)]! - sum[at(y0, x1)]! - sum[at(y1, x0)]! + sum[at(y0, x0)]!, c = count[at(y1, x1)]! - count[at(y0, x1)]! - count[at(y1, x0)]! + count[at(y0, x0)]!;
    if (c >= (x1 - x0) * (y1 - y0) / 4) out[y * width + x] = v - s / c;
  }
  return out;
}

/** The pixel offset (dx, dy) that moves the rendered mosaic onto the frame with the highest correlation of high-passed detail. */
export function registerToMosaic(frame: Float32Array, rendered: Float32Array, width: number, height: number, policy: MosaicRegisterPolicy = MOSAIC_REGISTER_POLICY): MosaicRegistration {
  const a = highPass(frame, width, height, policy.highPassPixels), b = highPass(rendered, width, height, policy.highPassPixels);
  let best = { correlation: -2, dx: 0, dy: 0, samples: 0 };
  for (let dy = -policy.searchPixels; dy <= policy.searchPixels; dy++) for (let dx = -policy.searchPixels; dx <= policy.searchPixels; dx++) {
    let n = 0, sa = 0, sb = 0, sab = 0, saa = 0, sbb = 0;
    for (let y = Math.max(0, -dy); y < Math.min(height, height - dy); y += 2) for (let x = Math.max(0, -dx); x < Math.min(width, width - dx); x += 2) {
      const p = a[y * width + x]!, q = b[(y + dy) * width + x + dx]!;
      if (!Number.isFinite(p) || !Number.isFinite(q)) continue;
      n++; sa += p; sb += q; sab += p * q; saa += p * p; sbb += q * q;
    }
    if (n < 500) continue;
    const correlation = (n * sab - sa * sb) / Math.sqrt((n * saa - sa * sa) * (n * sbb - sb * sb));
    if (correlation > best.correlation) best = { correlation, dx, dy, samples: n };
  }
  // The mosaic rendered at (x + dx, y + dy) matches the frame at (x, y): the camera should move by (-dx, -dy) to render it there.
  // Too few overlapping pixels (a disc a few dozen pixels across) leave no measurement: NaN correlation, no shift.
  if (best.samples === 0) return { shiftPixels: [0, 0], correlation: NaN, samples: 0, searchPixels: policy.searchPixels, highPassPixels: policy.highPassPixels };
  return { shiftPixels: [-best.dx, -best.dy], correlation: +best.correlation.toFixed(3), samples: best.samples, searchPixels: policy.searchPixels, highPassPixels: policy.highPassPixels };
}
