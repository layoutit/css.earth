import { CONTEXT_OBJECT_ASSET_URLS } from './prepared-context-objects.mts';
import { CONTEXT_OBJECT_PREPARED_JSON } from './prepared-context-json.mts';
import { parsePageDatasets } from './page-dataset-cards.mts';

/** The datasets a drawn page's package prepares (`prepared/datasets.json`, packages/bake/cli/prepare-map-sphere.mts), as
 * the shared dataset card shows them, with each lens's view; null when it prepares none. Pictures resolve to the package's
 * published files. Build only: the page reads the card, never this file (page-datasets.mts). */
export function pageDatasetLenses(objectId: string) {
  const base = `../src/objects/${objectId}/prepared/`, raw = CONTEXT_OBJECT_PREPARED_JSON[`${base}datasets.json`];
  return raw === undefined ? null : parsePageDatasets(objectId, raw, path => CONTEXT_OBJECT_ASSET_URLS[`${base}${path}`]);
}
