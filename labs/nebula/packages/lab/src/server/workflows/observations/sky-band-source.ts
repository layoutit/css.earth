/** An observation whose working raster is composed from pinned calibrated survey bands instead of downloaded. */
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { composeSkyBandPng } from '../../../adapters/sources/sky-bands.ts';
import type { ImageWcs } from '@cssearth/volume-core/coordinates/overlay-wcs';

export interface SkyBandSource { id: string; width: number; height: number; wcs: ImageWcs; skyBands: { path: string; sha256: string } }

/** The composed PNG and its evidence; the source record's dimensions and WCS must equal the recipe grid's. */
export async function composeSkyBandSource(source: SkyBandSource, root = process.cwd()) {
  const composed = await composeSkyBandPng(source.skyBands, { input: path => readFile(resolve(root, path)), cache: resolve(root, '.local/nebula-lab/sky-bands'),
    progress: message => console.log(`SKY_BANDS ${source.id} ${message}`) });
  if (composed.width !== source.width || composed.height !== source.height || JSON.stringify(composed.wcs) !== JSON.stringify(source.wcs))
    throw new Error(`${source.id}: the source record's dimensions or WCS differ from its sky band grid.`);
  return composed;
}
