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

export function surfaceBankInventory(plan: SurfaceBankPlan, datasets: SurfaceBankDatasets, assetPath: string) {
  const body = plan.body.assets.surface;
  const bodyPages = requireSurfacePages(body.urls, "Default surface", assetPath);
  const outer = plan.interior.outerAssets.surface;
  const outerOne = requireSurfacePages(outer.oneUrls, "Interior source surface", assetPath);
  const outerTwo = requireSurfacePages(outer.twoUrls, "Canonical interior surface", assetPath);
  if (outer.one !== outerOne[0] || outer.two !== outerTwo[0] ||
      outerOne.length !== bodyPages.length || outerTwo.length !== bodyPages.length ||
      body.url !== bodyPages[0]) {
    throw new TypeError("Earth prepared surface page metadata is inconsistent.");
  }
  const banks = datasets.controls.filter(dataset => !dataset.surfaceBankId).map((dataset) => {
    const urls = dataset.view === "interior" ? outerTwo
      : requireSurfacePages(dataset.surfaceUrls, `${dataset.id} surface`, assetPath);
    if (urls.length !== bodyPages.length || dataset.view !== "interior" && dataset.surfaceUrl !== urls[0]) {
      throw new TypeError("Earth dataset surface page metadata is inconsistent.");
    }
    if (dataset.id === datasets.defaultDataset &&
        JSON.stringify(urls) !== JSON.stringify(bodyPages)) {
      throw new TypeError("Earth default dataset does not match its prepared surface pages.");
    }
    return Object.freeze({ id: dataset.id, urls });
  });
  for (const dataset of datasets.controls.filter(dataset => dataset.view === "interior")) {
    const urls = requireSurfacePages(plan.interior.outerAssets.litSurface.urls, "Lit interior surface", assetPath);
    if (urls.length !== bodyPages.length) throw new TypeError("Lit interior surface page count differs.");
    banks.push(Object.freeze({ id: `${dataset.id}-lit`, urls }));
  }
  return Object.freeze(banks);
}
