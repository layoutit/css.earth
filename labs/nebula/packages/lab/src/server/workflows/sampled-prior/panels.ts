import sharp from 'sharp';
import type { CompilerImage } from '../compiler/images.ts';
import type { SkyBounds, SpatialField } from '@cssearth/bake/volume';

/** Diagnostic display-luminance comparison using the same depth-aware RGB material as the baked cloud. */
export async function sampledPanels(field: SpatialField, source: Pick<CompilerImage, 'sampleRgb'>, bounds: SkyBounds,
  sampleMaterial: (x: number, y: number, z: number, rgb: [number, number, number]) => boolean, width = 256) {
  const target = new Float32Array(width * width), projection = new Float32Array(width * width);
  const rgb: [number, number, number] = [0, 0, 0], light: [number, number, number] = [0, 0, 0], dz = (field.bounds.max[2] - field.bounds.min[2]) / 192;
  const covered = new Uint8Array(width * width);
  for (let y = 0; y < width; y++) for (let x = 0; x < width; x++) {
    const west = bounds.min[0] + (x + .5) / width * (bounds.max[0] - bounds.min[0]), north = bounds.max[1] - (y + .5) / width * (bounds.max[1] - bounds.min[1]), at = y * width + x;
    rgb.fill(0);
    if (source.sampleRgb(west, north, rgb)) { covered[at] = 1; target[at] = (.2126 * rgb[0] + .7152 * rgb[1] + .0722 * rgb[2]) / 255; }
    let transmission = 1, luminance = 0;
    for (let z = 0; z < 192; z++) {
      const depth = field.bounds.min[2] + (z + .5) * dz;
      field.sampleEmission(west, north, depth, light); if (!(light[0] > 0)) continue;
      const observed = sampleMaterial(west, north, depth, rgb);
      const colorLuminance = observed ? (.2126 * rgb[0] + .7152 * rgb[1] + .0722 * rgb[2]) / 255 : 1;
      const alpha = 1 - Math.exp(-light[0] * dz);
      luminance += transmission * alpha * colorLuminance; transmission *= 1 - alpha;
    }
    projection[at] = luminance;
  }
  const residual = Float32Array.from(target, (n, i) => n - projection[i]!);
  let squared = 0, baseline = 0, missing = 0, excess = 0, total = 0, count = 0;
  for (let i = 0; i < target.length; i++) if (covered[i]) {
    count++; squared += residual[i]! ** 2; baseline += target[i]! ** 2; total += target[i]!;
    missing += Math.max(0, residual[i]!); excess += Math.max(0, -residual[i]!);
  }
  const panel = async (data: Float32Array, signed = false) => {
    const rgba = Buffer.alloc(data.length * 4);
    for (let i = 0; i < data.length; i++) {
      const n = Math.round(Math.min(1, Math.abs(data[i]!)) * 255), at = i * 4;
      rgba[at] = signed && data[i]! < 0 ? 0 : n; rgba[at + 1] = signed ? 0 : n;
      rgba[at + 2] = signed && data[i]! > 0 ? 0 : n; rgba[at + 3] = covered[i] ? 255 : 0;
    }
    return sharp(rgba, { raw: { width, height: width, channels: 4 } }).png().toBuffer();
  };
  return { target: await panel(target), projection: await panel(projection), residual: await panel(residual, true),
    metrics: { fitRmse: Math.sqrt(squared / Math.max(1, count)), baselineRmse: Math.sqrt(baseline / Math.max(1, count)),
      missingSignalFraction: missing / Math.max(1e-12, total), excessSignalFraction: excess / Math.max(1e-12, total) } };
}
