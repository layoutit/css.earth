import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { projectRoot } from '@cssearth/core/node';
import type { FeatureIndexPin } from '../search/feature-search.mts';
import { parseCatalogueIndex, type CatalogueIndexEntry } from '../search/catalogue-index.mts';
import { keptLoad } from './kept-load.mts';

/** Reads a prepared file by its site path. */
export type ReadPrepared = (path: string) => Promise<unknown>;
/** What the find function and the no-JavaScript search read: the feature index pin, its files, and the object catalogue. */
export interface SearchData {
  readonly pin: FeatureIndexPin | null;
  readonly read: ReadPrepared;
  catalogue(): Promise<readonly CatalogueIndexEntry[]>;
}

const root = () => projectRoot(import.meta.url);
const jsonAt = async (path: string): Promise<unknown> => JSON.parse(await readFile(path, 'utf8'));

/** The feature index and places catalogues from `public/`. The deployed functions carry these files (netlify.toml
 * `included_files`): reading them over HTTP from the site and the asset bucket made a new instance's first search take
 * 3 to 4.5 s, from disk about 80 ms. */
export const readPublicFile: ReadPrepared = async path => {
  if (!/^\/[a-z0-9][a-z0-9/_.-]*\.json$/u.test(path) || path.includes('..')) throw new TypeError(`Prepared search file path is invalid: ${path}.`);
  return jsonAt(resolve(root(), 'public', path.slice(1)));
};

/** The object catalogue the build wrote (`pages/catalogue/index.json.ts`), for the deployed functions and a static
 * preview. It is computed under Vite, which the bundled functions cannot run, so they read the built file. */
export const readBuiltCatalogue: () => Promise<readonly CatalogueIndexEntry[]> =
  keptLoad(async () => parseCatalogueIndex(await jsonAt(resolve(root(), 'dist/catalogue/index.json'))).entries);

/** A built site's search data: its feature index pin and the files beside it. */
export function builtSearchData(pin: FeatureIndexPin | null): SearchData {
  return { pin, read: readPublicFile, catalogue: readBuiltCatalogue };
}
