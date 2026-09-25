import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import sharp from 'sharp';
import { preparePointAtlas } from '../../../src/renderers/css/preparation/stars/material.js';
import { parseStarsRecipe } from '../../../src/preparation/stars/config.js';
import { containedPath } from '@cssearth/volume-bake/compact-inputs/density-grid';
import { sha256 } from '@cssearth/core/node';
import type { CompilerStarSprites, PreparedCompilerStar } from '@cssearth/volume-core/contracts/compiler-bake';

/** The real site's prepared compact core/halo profile; never rebuilt in the viewer. */
export const COMPILER_STAR_PROFILE_PATH = 'src/objects/stellar-neighbourhood/source/stars.json';

/** Prepare an exact-RGB tiled PSF. Decode its alpha integral before preserving equivalent disk light. */
export async function prepareCompilerStarSprites(root: string, outputDirectory: string,
  stars: readonly Pick<PreparedCompilerStar, 'rgb' | 'materials'>[]): Promise<{ starSprites?: CompilerStarSprites }> {
  if (!stars.length) return {};
  if (stars.length > 5000) throw new TypeError('Compiler point sprites exceed the point budget.');
  const source = await readFile(resolve(root, COMPILER_STAR_PROFILE_PATH)), profile = parseStarsRecipe(JSON.parse(source.toString())).atlas;
  if (profile.tileSize > 256) throw new TypeError('Compiler point profile tile is too large.');
  const colors = new Map<string, [number, number, number]>();
  for (const star of stars) for (const material of [star, ...Object.values(star.materials ?? {})]) {
    if (!Array.isArray(material.rgb) || material.rgb.length !== 3 || !material.rgb.every(n => Number.isInteger(n) && n >= 0 && n <= 255))
      throw new TypeError('Compiler point sprite RGB must be encoded bytes.');
    colors.set(material.rgb.join(','), [...material.rgb]);
  }
  if (colors.size > 45000) throw new TypeError('Compiler point sprite palette exceeds the supported source budget.');
  const palette = [...colors.values()], tileSize = profile.tileSize, columns = Math.ceil(Math.sqrt(palette.length));
  const rows = Math.ceil(palette.length / columns), width = columns * tileSize, height = rows * tileSize;
  if (width > 8192 || height > 8192) throw new TypeError('Compiler point atlas exceeds the prepared image limit.');
  const pixels = Buffer.alloc(width * height * 4), entries: CompilerStarSprites['entries'] = {};
  let alphaIntegralPixels = 0;
  for (let row = 0; row < rows; row++) {
    const rowColors = palette.slice(row * columns, (row + 1) * columns);
    const prepared = await preparePointAtlas(rowColors, profile);
    const { data, info } = await sharp(prepared).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
    if (info.width !== rowColors.length * tileSize || info.height !== tileSize || info.channels !== 4) throw new Error('Point profile decoded dimensions changed.');
    for (let y = 0; y < tileSize; y++) data.copy(pixels, ((row * tileSize + y) * width) * 4, y * info.width * 4, (y + 1) * info.width * 4);
    rowColors.forEach((rgb, column) => { entries[rgb.join(',')] = { x: column * tileSize, y: row * tileSize }; });
    if (row === 0) for (let y = 0; y < tileSize; y++) for (let x = 0; x < tileSize; x++) alphaIntegralPixels += data[(y * info.width + x) * 4 + 3]! / 255;
  }
  if (!(alphaIntegralPixels > 0)) throw new Error('Prepared stellar profile has no light.');
  const bytes = await sharp(pixels, { raw: { width, height, channels: 4 } }).png({ compressionLevel: 9 }).toBuffer();
  const directory = containedPath(root, outputDirectory); await mkdir(directory, { recursive: true });
  const path = `${outputDirectory.replace(/\/$/, '')}/star-atlas.png`; await writeFile(containedPath(root, path), bytes);
  // Previous angular diameter denotes a flat circle: integral area pi*d²/4.
  // Preserve every channel and peak opacity. Expand the tile to compensate its decoded PSF area.
  const diameterScale = Math.sqrt(Math.PI * tileSize * tileSize / (4 * alphaIntegralPixels));
  return { starSprites: { schema: 'cssearth-compiler-star-sprites@1', atlas: { path },
    width, height, tileSize, entries, diameterScale, alphaScale: 1, alphaIntegralPixels,
    profile: { path: COMPILER_STAR_PROFILE_PATH } } };
}
