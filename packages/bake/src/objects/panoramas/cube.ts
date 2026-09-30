/** Resample a published cylindrical panorama onto the sky cube's six faces, in the panorama's local frame (x north, y west,
 * z up; azimuth clockwise from north). Pure: pixels in, pixels out. */
import { SKY_BASES, skyRay, type SkyBasis } from '../../sky/index.ts';
import type { PanoramaProjection } from './document.ts';

export interface RgbImage { readonly width: number; readonly height: number; readonly rgb: Uint8Array }

/** Image coordinates (continuous, pixel centres at +0.5) of a direction, or null above or below the image. One scale in
 * both axes: the image's width spans 360°. */
export function cylinderPixel(image: Pick<RgbImage, 'width' | 'height'>, projection: Pick<PanoramaProjection, 'azimuthAtCentreDeg' | 'topElevationDeg'>,
  azimuthDeg: number, elevationDeg: number): readonly [number, number] | null {
  const perDeg = image.width / 360;
  const x = ((((azimuthDeg - projection.azimuthAtCentreDeg + 180) % 360) + 360) % 360) * perDeg;
  const y = (projection.topElevationDeg - elevationDeg) * perDeg;
  return y < 0 || y > image.height ? null : [x, y];
}

/** A direction's azimuth (clockwise from north) and elevation, both in degrees. */
export function azimuthElevation([north, west, up]: readonly [number, number, number]): readonly [number, number] {
  return [((Math.atan2(-west, north) * 180 / Math.PI) + 360) % 360, Math.asin(Math.max(-1, Math.min(1, up))) * 180 / Math.PI];
}

/**
 * One face as RGBA: bilinear in the source bytes, wrapping in azimuth. A direction outside the image, or whose samples are
 * mostly the publisher's black fill, is transparent: unimaged, not invented.
 */
export function panoramaFacePixels(image: RgbImage, projection: PanoramaProjection, basis: SkyBasis, size: number): Uint8Array {
  const { width, height, rgb } = image, rgba = new Uint8Array(size * size * 4);
  const fill = (index: number) => !(rgb[index * 3]! | rgb[index * 3 + 1]! | rgb[index * 3 + 2]!);
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const [azimuth, elevation] = azimuthElevation(skyRay(basis, 2 * (x + .5) / size - 1, 1 - 2 * (y + .5) / size) as [number, number, number]);
    const at = cylinderPixel(image, projection, azimuth, elevation);
    if (!at) continue;
    const fx = at[0] - .5, fy = Math.max(0, Math.min(height - 1, at[1] - .5));
    const x0 = Math.floor(fx), ax = fx - x0, y0 = Math.floor(fy), ay = fy - y0, y1 = Math.min(y0 + 1, height - 1);
    const left = ((x0 % width) + width) % width, right = (left + 1) % width;
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
