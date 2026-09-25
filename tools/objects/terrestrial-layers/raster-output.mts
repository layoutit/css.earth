import { sha256 } from '@cssearth/core/node';
import { writeLossyWebp } from '../../../src/preparation/raster/lossy-lane.ts';
import type { Sharp, WebpOptions } from 'sharp';
import sharp from 'sharp';
import { writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

/** An encoding with neither `lossless` nor `quality` is written in the lossy lane (lossy-lane.ts). One that fixes a quality,
 * and every lossless encoding, is written as given. */
export function createRasterEmitter(publicDirectory:string, publicBase:string) {
  return async (filename:string, pipeline:Sharp, encoding:WebpOptions = { lossless: true, effort: 4 }) => {
    const path = resolve(publicDirectory, filename);
    const bytes = !encoding.lossless && encoding.quality === undefined
      ? await writeLossyWebp(pipeline, path, encoding)
      : await pipeline.webp(encoding).toBuffer();
    if (encoding.lossless || encoding.quality !== undefined) await writeFile(path, bytes);
    const { width, height } = await sharp(bytes).metadata();
    if (!width || !height) throw new Error(`Raster output has no dimensions: ${filename}`);
    return { url: `${publicBase}${filename}`, width, height, bytes: bytes.length,
      sha256: sha256(bytes) };
  };
}
