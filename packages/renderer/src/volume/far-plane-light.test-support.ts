import sharp from 'sharp';
import type { PreparedVolumeLeaf } from '@cssearth/objects';
import type { PreparedVolumeCameraTransform } from './types.js';

/** Offline numerical oracle: decoded premultiplied bilinear image samples, perspective plane intersection,
 * depth-sorted source-over, black completed-stack matte. No browser color-management or GPU rounding claim. */
export interface LightImage {
  leaf: PreparedVolumeLeaf;
  pixels: Uint8Array;
}
export async function decodeLightImage(leaf: PreparedVolumeLeaf, directory: URL): Promise<LightImage> {
  const { data, info } = await sharp(new URL(leaf.texturePath, directory).pathname).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  if (info.channels !== 4 || info.width !== leaf.widthPx || info.height !== leaf.heightPx) throw new TypeError('Unexpected light-oracle image dimensions.');
  return { leaf, pixels: data };
}
type Vector = readonly number[];
const dot = (a: Vector, b: Vector) => a.reduce((sum, value, i) => sum + value * b[i]!, 0);

export function projectLightImage(image: LightImage, view: PreparedVolumeCameraTransform) {
  const { leaf } = image, m = leaf.style.transform.slice(9, -1).split(',').map(Number);
  const rows = [view.rotation.slice(0, 3), view.rotation.slice(3, 6), view.rotation.slice(6, 9)];
  const u = rows.map(row => dot(row, m.slice(0, 3)) * Number.parseFloat(leaf.style.width) / leaf.widthPx);
  const v = rows.map(row => dot(row, m.slice(4, 7)) * Number.parseFloat(leaf.style.height) / leaf.heightPx);
  const c = rows.map((row, i) => dot(row, m.slice(12, 15)) + view.translationCssPixels[i]!);
  const corners = [[0, 0], [leaf.widthPx, 0], [0, leaf.heightPx], [leaf.widthPx, leaf.heightPx]].map(([x, y]) => {
    const p = c.map((value, i) => value + u[i]! * x! + v[i]! * y!);
    if (view.focalPixels <= p[2]!) throw new TypeError('Light oracle requires every plane in front of its camera.');
    return [view.focalPixels * p[0]! / (view.focalPixels - p[2]!), view.focalPixels * p[1]! / (view.focalPixels - p[2]!)];
  });
  return { ...image, u, v, c, corners, depth: c[2]! + u[2]! * leaf.widthPx / 2 + v[2]! * leaf.heightPx / 2 };
}
type Projected = ReturnType<typeof projectLightImage>;

export interface LightGrid { left: number; top: number; width: number; height: number; scale: number }
export function lightGrid(images: readonly Projected[], scale = 3): LightGrid {
  const points = images.flatMap(image => image.corners);
  const left = Math.floor(Math.min(...points.map(p => p[0]!)) * scale), top = Math.floor(Math.min(...points.map(p => p[1]!)) * scale);
  const width = Math.ceil(Math.max(...points.map(p => p[0]!)) * scale) - left;
  const height = Math.ceil(Math.max(...points.map(p => p[1]!)) * scale) - top;
  if (width * height > 4_000_000) throw new TypeError('Light oracle raster exceeds its bounded test budget.');
  return { left, top, width, height, scale };
}
export function integratedStackLight(images: readonly Projected[], opacity: number | readonly number[], focal: number, scale = 3): number {
  if (!images.length) return 0;
  return rasterStackLight(images, opacity, focal, lightGrid(images, scale)).reduce((sum, value) => sum + value, 0) / scale ** 2;
}
export function rasterStackLight(images: readonly Projected[], opacities: number | readonly number[], focal: number, grid: LightGrid): Float64Array {
  const { left, top, width, height, scale } = grid;
  const light = new Float64Array(width * height);
  const layers = images.map((image, index) => ({ image, opacity: typeof opacities === 'number' ? opacities : opacities[index]! }));
  for (const { image, opacity } of layers.sort((a, b) => a.image.depth - b.image.depth)) {
    const { u, v, c, pixels, leaf, corners } = image;
    const x0 = Math.max(0, Math.floor(Math.min(...corners.map(p => p[0]!)) * scale) - left);
    const x1 = Math.min(width, Math.ceil(Math.max(...corners.map(p => p[0]!)) * scale) - left);
    const y0 = Math.max(0, Math.floor(Math.min(...corners.map(p => p[1]!)) * scale) - top);
    const y1 = Math.min(height, Math.ceil(Math.max(...corners.map(p => p[1]!)) * scale) - top);
    for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) {
      const sx = (x + left + .5) / scale, sy = (y + top + .5) / scale;
      const a = focal * u[0]! + sx * u[2]!, b = focal * v[0]! + sx * v[2]!;
      const d = focal * u[1]! + sy * u[2]!, e = focal * v[1]! + sy * v[2]!;
      const determinant = a * e - b * d;
      if (Math.abs(determinant) < 1e-10) continue;
      const rx = sx * (focal - c[2]!) - focal * c[0]!, ry = sy * (focal - c[2]!) - focal * c[1]!;
      const px = (rx * e - b * ry) / determinant, py = (a * ry - rx * d) / determinant;
      if (px < 0 || py < 0 || px >= leaf.widthPx || py >= leaf.heightPx) continue;
      const tx = Math.max(0, Math.min(leaf.widthPx - 1, px - .5)), ty = Math.max(0, Math.min(leaf.heightPx - 1, py - .5));
      const ix = Math.floor(tx), iy = Math.floor(ty), fx = tx - ix, fy = ty - iy;
      let alpha = 0, emission = 0;
      for (let j = 0; j <= 1; j++) for (let i = 0; i <= 1; i++) {
        const weight = (i ? fx : 1 - fx) * (j ? fy : 1 - fy);
        const source = (Math.min(leaf.heightPx - 1, iy + j) * leaf.widthPx + Math.min(leaf.widthPx - 1, ix + i)) * 4;
        const coverage = pixels[source + 3]! / 255 * weight * opacity;
        alpha += coverage; emission += (pixels[source]! + pixels[source + 1]! + pixels[source + 2]!) / 255 * coverage;
      }
      const index = y * width + x;
      light[index] = emission + light[index]! * (1 - alpha);
    }
  }
  return light;
}
