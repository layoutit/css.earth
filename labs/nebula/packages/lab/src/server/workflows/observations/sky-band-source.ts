/** An observation whose working raster is composed from pinned calibrated survey bands instead of downloaded. */
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { composeSkyBandPng, skyBandGridWcs, verifySkyBandRecipe } from '../../../adapters/sources/sky-bands.ts';
import type { ImageWcs } from '@cssearth/bake/volume';

export interface SkyBandSource { id: string; width: number; height: number; wcs: ImageWcs; skyBands: { path: string } }

/** Verify the pinned recipe (and every tile list) and that the source record's grid is exactly the recipe grid.
 * Callers run this before trusting a cached composite, so a warm cache fails the same way as a cold one. */
export async function verifySkyBandSource(source: SkyBandSource, root = process.cwd()) {
  const verified = await verifySkyBandRecipe(source.skyBands, path => readFile(resolve(root, path)));
  if (verified.recipe.grid.width !== source.width || verified.recipe.grid.height !== source.height || JSON.stringify(skyBandGridWcs(verified.recipe.grid)) !== JSON.stringify(source.wcs))
    throw new Error(`${source.id}: the source record's dimensions or WCS differ from its sky band grid.`);
  return verified;
}

/** The composed PNG and its evidence; the source record's dimensions and WCS must equal the recipe grid's. */
export async function composeSkyBandSource(source: SkyBandSource, root = process.cwd()) {
  const composed = await composeSkyBandPng(source.skyBands, { input: path => readFile(resolve(root, path)), cache: resolve(root, '.local/nebula-lab/sky-bands'),
    progress: message => console.log(`SKY_BANDS ${source.id} ${message}`) });
  if (composed.width !== source.width || composed.height !== source.height || JSON.stringify(composed.wcs) !== JSON.stringify(source.wcs))
    throw new Error(`${source.id}: the source record's dimensions or WCS differ from its sky band grid.`);
  return composed;
}
