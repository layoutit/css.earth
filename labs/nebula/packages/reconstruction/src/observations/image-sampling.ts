import sharp from 'sharp';
import type { SkyBounds } from '@cssearth/bake/volume';
import type {CompilerRaster,CompilerImage} from './compiler-image.ts';
export function sampleRaster(layer: CompilerRaster, x: number, y: number, out: [number, number, number]): boolean {
  if (x < 0 || y < 0 || x >= layer.width || y >= layer.height) return false;
  const px = Math.max(0, Math.min(layer.width - 1, x - .5)), py = Math.max(0, Math.min(layer.height - 1, y - .5));
  const x0 = Math.floor(px), y0 = Math.floor(py), x1 = Math.min(layer.width - 1, x0 + 1), y1 = Math.min(layer.height - 1, y0 + 1), u = px - x0, v = py - y0;
  for (let c = 0; c < 3; c++) {
    const a = layer.data[(y0 * layer.width + x0) * 3 + c]!, b = layer.data[(y0 * layer.width + x1) * 3 + c]!;
    const d = layer.data[(y1 * layer.width + x0) * 3 + c]!, e = layer.data[(y1 * layer.width + x1) * 3 + c]!;
    out[c] = (a + (b - a) * u) * (1 - v) + (d + (e - d) * u) * v;
  }
  return true;
}
export async function compilerImagePanel(image: CompilerImage, bounds: SkyBounds, original: boolean, width = 768) {
  const height = Math.max(1, Math.round(width * (bounds.max[1] - bounds.min[1]) / (bounds.max[0] - bounds.min[0]))), rgba = Buffer.alloc(width * height * 4), rgb: [number, number, number] = [0, 0, 0];
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
    const west = bounds.min[0] + (x + .5) / width * (bounds.max[0] - bounds.min[0]), north = bounds.max[1] - (y + .5) / height * (bounds.max[1] - bounds.min[1]);
    if (!(original ? image.sampleOriginal : image.sampleRgb)(west, north, rgb)) continue;
    const at = (y * width + x) * 4; for (let c = 0; c < 3; c++) rgba[at + c] = Math.round(rgb[c]!); rgba[at + 3] = 255;
  }
  return { width, height, bytes: await sharp(rgba, { raw: { width, height, channels: 4 } }).png().toBuffer() };
}
