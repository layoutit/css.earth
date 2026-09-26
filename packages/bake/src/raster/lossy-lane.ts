/**
 * The lossy lane: lossy images a bake writes are WebP at one quality constant, with sharp YUV chroma
 * (`smartSubsample`). Numeric and categorical images stay lossless and never come here.
 *
 * Quality 80, measured 2026-09-23 with pixelmatch (threshold 0.1) against the files it replaces:
 * - Europa, Moon and Phobos surfaces, Mercury's interior and Saturn's interior section flag 0 pixels; at quality 75
 *   the three surfaces flag 549 to 1798 pixels.
 * - Deimos, already lossy, flags 485 of 26 million (0.002 %) at 75, 80 and 85 alike.
 * - An Earth ENSO page 2048 level, previously lossless, flags 2761 of 3.9 million (0.07 %), 2450 at 85: edges of its
 *   colour classes.
 */
import type { Sharp, WebpOptions } from 'sharp';
import { mkdir, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';

export const LOSSY_WEBP = Object.freeze({ quality: 80, smartSubsample: true });

/**
 * Decorative images (sidebar dataset maps and volume dataset previews): the body carries the data, so these take quality
 * 40. Measured 2026-09-25 over the 1,327 published sidebar maps with pixelmatch (threshold 0.1) against the quality 90
 * maps they replaced: 15.8 MB became 4.8 MB with 0.074 % of pixels flagged and no flagged pixel in half the maps;
 * quality 30 flagged 0.119 %. The 42 volume previews at 600 px flag 0.104 % against a lossless resize.
 */
export const DECORATIVE_WEBP = Object.freeze({ quality: 40, alphaQuality: 80, smartSubsample: true, effort: 4 });

/** Settings a caller may add: effort, and exact alpha for shading or coverage carried in alpha. */
export type LossyWebpBase = Omit<WebpOptions, 'quality' | 'lossless' | 'nearLossless' | 'smartSubsample'>;

/** Encode `image` in the lossy lane. */
export function encodeLossyWebp(image: Sharp, base: LossyWebpBase = {}): Promise<Buffer> {
  return image.webp({ ...base, ...LOSSY_WEBP }).toBuffer();
}
/** Encode `image` in the lossy lane and write it; returns the bytes written. */
export async function writeLossyWebp(image: Sharp, path: string, base: LossyWebpBase = {}): Promise<Buffer> {
  const bytes = await encodeLossyWebp(image, base);
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, bytes);
  return bytes;
}
