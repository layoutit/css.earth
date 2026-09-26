/** Offline stars preparation CLI; implementation is shared with image restoration. */
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { prepareStarsObject as prepareStars } from '@cssearth/bake/stars';
import { inventoryPreparedAssets } from '../../src/platform/runtime-asset-closure.mts';

/** The star preparation with this checkout's inventory of the published prepared closure. */
export const prepareStarsObject = (options: { objectDirectory: string; outputDirectory?: string }) => prepareStars({ ...options, inventory: inventoryPreparedAssets });

if (process.argv[1] && import.meta.url===pathToFileURL(resolve(process.argv[1])).href) {
  if (!process.argv[2] || process.argv[3]) throw new TypeError('Usage: prepare-stars <object-directory>');
  await prepareStarsObject({objectDirectory:process.argv[2]});
}
