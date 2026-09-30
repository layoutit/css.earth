import { isArray } from '@cssearth/core';
import type {SurfaceBankPlan, SurfaceBankDatasets} from './contracts.ts';
export function requireSurfacePages(urls: unknown, label: string, assetPath: string) {
  if (typeof assetPath !== "string" || !assetPath.startsWith("/scenes/")) throw new TypeError("Surface banks require an explicit object asset path.");
  if (!isArray(urls) || urls.length === 0 ||
      urls.some((url) => typeof url !== "string" || !url.startsWith(assetPath)) ||
      new Set(urls).size !== urls.length) {
    throw new TypeError(`${label} requires unique prepared page URLs.`);
  }
  return Object.freeze(urls.map((url: unknown) => { if (typeof url !== "string") throw new TypeError("Invalid surface page URL."); return url; }));
}

/** One bank per dataset with its own pages. A dataset that names another's bank, or shows the interior (the cutaway
 * shell is the surface itself), reads the default dataset's pages: no second copy of the surface is prepared. */
export function surfaceBankInventory(plan: SurfaceBankPlan, datasets: SurfaceBankDatasets, assetPath: string) {
  const body = plan.body.assets.surface;
  const bodyPages = requireSurfacePages(body.urls, "Default surface", assetPath);
  if (body.url !== bodyPages[0]) throw new TypeError("Earth prepared surface page metadata is inconsistent.");
  const banks = datasets.controls.filter(dataset => !dataset.surfaceBankId && dataset.view !== "interior").map((dataset) => {
    const urls = requireSurfacePages(dataset.surfaceUrls, `${dataset.id} surface`, assetPath);
    if (urls.length !== bodyPages.length || dataset.surfaceUrl !== urls[0]) {
      throw new TypeError("Earth dataset surface page metadata is inconsistent.");
    }
    if (dataset.id === datasets.defaultDataset &&
        JSON.stringify(urls) !== JSON.stringify(bodyPages)) {
      throw new TypeError("Earth default dataset does not match its prepared surface pages.");
    }
    return Object.freeze({ id: dataset.id, urls });
  });
  return Object.freeze(banks);
}
