/** Offline volume preparation CLI; implementation is shared with image restoration. */
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { prepareDensityVolumeObject as prepareDensityVolume } from '@cssearth/bake/density';
import { inventoryPreparedAssets } from '../../src/platform/runtime-asset-closure.mts';

/** The density-volume preparation with this checkout's inventory of the published prepared closure. */
export const prepareDensityVolumeObject = (options: { objectDirectory: string; outputDirectory?: string; acquisitionCache?: string }) =>
  prepareDensityVolume({ ...options, inventory: inventoryPreparedAssets });

const direct = process.argv[1] !== undefined && import.meta.url === pathToFileURL(resolve(process.argv[1])).href;
if (direct) {
  const directory = process.argv[2];
  const acquire = process.argv[3] === '--acquire-source' && process.argv[4] && !process.argv[5];
  if (!directory || (process.argv[3] && !acquire)) throw new TypeError('Usage: prepare-volume <object-directory> [--acquire-source <cache-directory>]');
  await prepareDensityVolumeObject({ objectDirectory: directory, ...(acquire ? { acquisitionCache: process.argv[4] } : {}) });
}
