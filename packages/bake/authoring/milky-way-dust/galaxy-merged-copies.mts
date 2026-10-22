// Folds the runtime's three coincident optical copies of each galaxy slice into its image (prepared-volume-runtime.ts).
import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import sharp from 'sharp';

/** The copies the runtime stacks for one slice, and the copies a merged image holds. */
export const MERGED_OPTICAL_COPIES = 3;

/** Three copies of one straight-alpha image composite to the same color at alpha 1 - (1 - a)^3: the merged image is
 * that, so one layer at opacity gain / 3 stands for the copies. That opacity scales alpha linearly, where the copies
 * compose it, so they agree exactly for faint material and the merged image is slightly lighter where a slice is
 * nearly opaque. On a phone the three copies of the 52/52/26 bank were 390 full-screen layers, past Chrome's 256 MB
 * tile budget: layers drew empty in 248 frames of an 8 s turn (2026-10-22). */
export function mergedAlpha(alpha: number): number {
  return Math.round((1 - (1 - alpha / 255) ** MERGED_OPTICAL_COPIES) * 255);
}

/** Rewrites every slice image `<directory>/<axis>/<nnn>.png` in place with its copies merged. */
export async function mergeOpticalCopies(directory: string): Promise<number> {
  let merged = 0;
  for (const axis of ['x', 'y', 'z']) for (const name of readdirSync(resolve(directory, axis)).filter(name => /^\d{3}\.png$/u.test(name)).sort()) {
    const path = resolve(directory, axis, name);
    const { data, info } = await sharp(readFileSync(path)).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
    if (info.channels !== 4) throw new TypeError(`Slice ${axis}/${name} is not RGBA.`);
    for (let index = 3; index < data.length; index += 4) data[index] = mergedAlpha(data[index]!);
    writeFileSync(path, await sharp(data, { raw: { width: info.width, height: info.height, channels: 4 } }).png({ compressionLevel: 9 }).toBuffer());
    merged++;
  }
  return merged;
}
