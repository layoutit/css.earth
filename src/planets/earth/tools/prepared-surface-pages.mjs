import { PREPARED_EARTH_SCENE } from "../runtime/preparedScene.mjs";
import { PREPARED_EARTH_LENSES } from "../runtime/preparedLenses.mjs";
export function requireEarthSurfacePages(urls, label = "Earth surface") {
  if (!Array.isArray(urls) || urls.length === 0 ||
      urls.some((url) => typeof url !== "string" || !url.startsWith("/scenes/earth/")) ||
      new Set(urls).size !== urls.length) {
    throw new TypeError(`${label} requires unique prepared page URLs.`);
  }
  return Object.freeze([...urls]);
}

export function earthSurfaceBankInventory() {
  const body = PREPARED_EARTH_SCENE.body.assets.surface;
  const bodyPages = requireEarthSurfacePages(body.urls, "Earth default surface");
  const outer = PREPARED_EARTH_SCENE.interior.outerAssets.surface;
  const outerOne = requireEarthSurfacePages(outer.oneUrls, "Earth interior source surface");
  const outerTwo = requireEarthSurfacePages(outer.twoUrls, "Earth canonical interior surface");
  if (outer.one !== outerOne[0] || outer.two !== outerTwo[0] ||
      outerOne.length !== bodyPages.length || outerTwo.length !== bodyPages.length ||
      body.url !== bodyPages[0]) {
    throw new TypeError("Earth prepared surface page metadata is inconsistent.");
  }
  const banks = PREPARED_EARTH_LENSES.controls.filter(lens => !lens.surfaceBankId).map((lens) => {
    const urls = lens.view === "interior" ? outerTwo
      : requireEarthSurfacePages(lens.surfaceUrls, `Earth ${lens.id} surface`);
    if (urls.length !== bodyPages.length || lens.view !== "interior" && lens.surfaceUrl !== urls[0]) {
      throw new TypeError("Earth lens surface page metadata is inconsistent.");
    }
    if (lens.id === PREPARED_EARTH_LENSES.defaultLens &&
        JSON.stringify(urls) !== JSON.stringify(bodyPages)) {
      throw new TypeError("Earth default lens does not match its prepared surface pages.");
    }
    return Object.freeze({ id: lens.id, urls });
  });
  return Object.freeze(banks);
}
