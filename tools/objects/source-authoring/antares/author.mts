#!/usr/bin/env node
/** Antares authored input: the navigation marker, a flat disc in the shared neutral gray, because no image of the photosphere
 * is cast in this package (see the object's investigations.json).
 *
 *   node tools/objects/source-authoring/antares/author.mts [--check] */
import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import sharp from 'sharp';

const root = resolve(import.meta.dirname, '../../../../src/objects/antares/source');
export const CONTEXT_PATH = 'presentation/context.png';
export const CONTEXT_SIZE = 512;

/** A flat disc in the shared neutral gray on a transparent field: the marker of an unresolved, self-luminous surface. */
export async function neutralDiscMarker(size = CONTEXT_SIZE, fill = 0.9) {
  const rgba = Buffer.alloc(size * size * 4), c = (size - 1) / 2, radius = size * fill / 2;
  for (let row = 0; row < size; row++) for (let col = 0; col < size; col++) {
    const distance = Math.hypot(col - c, row - c);
    if (distance > radius + 0.5) continue;
    const alpha = Math.round(255 * Math.max(0, Math.min(1, radius + 0.5 - distance)));
    rgba.set([128, 128, 128, alpha], (row * size + col) * 4);
  }
  return sharp(rgba, { raw: { width: size, height: size, channels: 4 } }).png({ compressionLevel: 9 }).toBuffer();
}

export async function authorAntares({ check = false } = {}) {
  const marker = await neutralDiscMarker();
  const target = resolve(root, CONTEXT_PATH);
  if (check) { if (!(await readFile(target)).equals(marker)) throw new Error(`${CONTEXT_PATH} differs from its authored recomputation.`); }
  else await writeFile(target, marker);
  return { size: CONTEXT_SIZE };
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  await authorAntares({ check: process.argv.includes('--check') });
  console.log('Antares: neutral disc navigation marker written.');
}
