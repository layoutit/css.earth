/** Resample a published cylindrical panorama onto the sky cube's six faces, in the panorama's local frame (x north, y west,
 * z up; azimuth clockwise from north). Pure: pixels in, pixels out. */
import { SKY_BASES, skyRay, type SkyBasis } from '../../sky/index.ts';
import type { StatedCylinderPlacement } from './document.ts';

export interface RgbImage { readonly width: number; readonly height: number; readonly rgb: Uint8Array }

/**
 * Where directions fall in a cylindrical panorama with one scale in both axes: azimuth grows clockwise from the left edge,
 * and the horizon (0° elevation) runs from `horizonRow` at the left edge along `horizonSlope` rows a column, a camera that
 * was not quite level. The image may span more or less than 360°.
 */
export interface PanoramaGeometry {
  readonly pxPerDeg: number;
  readonly azimuthAtLeftDeg: number;
  readonly horizonRow: number;
  readonly horizonSlope: number;
}

/** A stated cylinder: its width spans 360°, the centre column faces the stated azimuth and the top row the stated elevation. */
export function statedGeometry(width: number, placement: Pick<StatedCylinderPlacement, 'azimuthAtCentreDeg' | 'topElevationDeg'>): PanoramaGeometry {
  const pxPerDeg = width / 360;
  return { pxPerDeg, azimuthAtLeftDeg: placement.azimuthAtCentreDeg - 180, horizonRow: placement.topElevationDeg * pxPerDeg, horizonSlope: 0 };
}

/** The same geometry on the image resized by `factor`. */
export const scaledGeometry = (geometry: PanoramaGeometry, factor: number): PanoramaGeometry =>
  ({ ...geometry, pxPerDeg: geometry.pxPerDeg * factor, horizonRow: geometry.horizonRow * factor });

/** Image coordinates (continuous, pixel centres at +0.5) of a direction, or null outside the image. Where the image spans
 * more than 360°, the first turn from the left edge is used. */
export function cylinderPixel(image: Pick<RgbImage, 'width' | 'height'>, geometry: PanoramaGeometry, azimuthDeg: number, elevationDeg: number): readonly [number, number] | null {
  const x = ((((azimuthDeg - geometry.azimuthAtLeftDeg) % 360) + 360) % 360) * geometry.pxPerDeg;
  const y = geometry.horizonRow + geometry.horizonSlope * x - elevationDeg * geometry.pxPerDeg;
  return x > image.width || y < 0 || y > image.height ? null : [x, y];
}

/** A direction's azimuth (clockwise from north) and elevation, both in degrees. */
export function azimuthElevation([north, west, up]: readonly [number, number, number]): readonly [number, number] {
  return [((Math.atan2(-west, north) * 180 / Math.PI) + 360) % 360, Math.asin(Math.max(-1, Math.min(1, up))) * 180 / Math.PI];
}

/**
 * One face as RGBA: bilinear in the source bytes, wrapping in azimuth. A direction outside the image, or whose samples are
 * mostly the publisher's black fill, is transparent: unimaged, not invented.
 */
export function panoramaFacePixels(image: RgbImage, geometry: PanoramaGeometry, basis: SkyBasis, size: number): Uint8Array {
  const { width, height, rgb } = image, rgba = new Uint8Array(size * size * 4), wraps = width >= 360 * geometry.pxPerDeg - .5;
  const fill = (index: number) => !(rgb[index * 3]! | rgb[index * 3 + 1]! | rgb[index * 3 + 2]!);
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const [azimuth, elevation] = azimuthElevation(skyRay(basis, 2 * (x + .5) / size - 1, 1 - 2 * (y + .5) / size) as [number, number, number]);
    const at = cylinderPixel(image, geometry, azimuth, elevation);
    if (!at) continue;
    const fx = at[0] - .5, fy = Math.max(0, Math.min(height - 1, at[1] - .5));
    const x0 = Math.floor(fx), ax = fx - x0, y0 = Math.floor(fy), ay = fy - y0, y1 = Math.min(y0 + 1, height - 1);
    const left = wraps ? ((x0 % width) + width) % width : Math.max(0, Math.min(width - 1, x0)), right = wraps ? (left + 1) % width : Math.min(left + 1, width - 1);
    const index = [y0 * width + left, y0 * width + right, y1 * width + left, y1 * width + right] as const;
    const weight = [(1 - ax) * (1 - ay), ax * (1 - ay), (1 - ax) * ay, ax * ay].map((w, k) => fill(index[k]) ? 0 : w);
    const total = weight[0]! + weight[1]! + weight[2]! + weight[3]!;
    if (total < .5) continue;
    const out = (y * size + x) * 4;
    for (let c = 0; c < 3; c++) rgba[out + c] = Math.round((rgb[index[0] * 3 + c]! * weight[0]! + rgb[index[1] * 3 + c]! * weight[1]! +
      rgb[index[2] * 3 + c]! * weight[2]! + rgb[index[3] * 3 + c]! * weight[3]!) / total);
    rgba[out + 3] = 255;
  }
  return rgba;
}

export { SKY_BASES };
