/** Offline volume texture encoding; optical coverage always retains lossless alpha. */
import sharp from 'sharp';
import type { VolumeImageEncoding } from '../../contracts/volume-recipe.ts';

export async function encodeVolumeRaster(options: {
  rgba: Buffer; width: number; height: number;
  crop: { left: number; top: number; width: number; height: number };
  encoding?: VolumeImageEncoding;
}): Promise<Buffer> {
  const pipeline = sharp(options.rgba, { raw: { width: options.width, height: options.height, channels: 4 } }).extract(options.crop);
  return options.encoding?.format === 'webp'
    ? pipeline.webp({ quality: options.encoding.quality ?? 90, alphaQuality: 100, effort: 5, smartSubsample: true }).toBuffer()
    : pipeline.png().toBuffer();
}
