// The Worker's site/server/search-data.mts: the same exports, read from the built site's assets instead of a disk.
// deploy/cloudflare/bundle-worker.mts swaps this module in, so the handlers and their warm-instance cache
// (site/server/find.mts keys it on `readPublicFile`) are the ones Netlify runs.
import { parseCatalogueIndex, type CatalogueIndexEntry } from '../../site/search/catalogue-index.mts';
import type { FeatureIndexPin } from '../../site/search/feature-search.mts';
import type { ReadPrepared, SearchData } from '../../site/server/search-data.mts';
import { keptLoad } from '../../site/server/kept-load.mts';
import { readAssetJson } from './assets.ts';

export type { ReadPrepared, SearchData };

/** The feature index and places catalogues, which the bundle step stages beside the built pages. */
export const readPublicFile: ReadPrepared = async path => {
  if (!/^\/[a-z0-9][a-z0-9/_.-]*\.json$/u.test(path) || path.includes('..')) throw new TypeError(`Prepared search file path is invalid: ${path}.`);
  return readAssetJson(path);
};

/** The object catalogue the build wrote (`pages/catalogue/index.json.ts`). */
export const readBuiltCatalogue: () => Promise<readonly CatalogueIndexEntry[]> =
  keptLoad(async () => parseCatalogueIndex(await readAssetJson('/catalogue/index.json')).entries);

/** A built site's search data: its feature index pin and the files beside it. */
export function builtSearchData(pin: FeatureIndexPin | null): SearchData {
  return { pin, read: readPublicFile, catalogue: readBuiltCatalogue };
}
