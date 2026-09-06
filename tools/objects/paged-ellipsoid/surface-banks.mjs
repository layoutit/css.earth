export function requireSurfacePages(urls, label, assetPath) {
  if (typeof assetPath !== "string" || !assetPath.startsWith("/scenes/")) throw new TypeError("Surface banks require an explicit object asset path.");
  if (!Array.isArray(urls) || urls.length === 0 ||
      urls.some((url) => typeof url !== "string" || !url.startsWith(assetPath)) ||
      new Set(urls).size !== urls.length) {
    throw new TypeError(`${label} requires unique prepared page URLs.`);
  }
  return Object.freeze([...urls]);
}

export function surfaceBankInventory(plan,lenses,assetPath) {
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
  const banks = lenses.controls.filter(lens => !lens.surfaceBankId).map((lens) => {
    const urls = lens.view === "interior" ? outerTwo
      : requireSurfacePages(lens.surfaceUrls, `${lens.id} surface`, assetPath);
    if (urls.length !== bodyPages.length || lens.view !== "interior" && lens.surfaceUrl !== urls[0]) {
      throw new TypeError("Earth lens surface page metadata is inconsistent.");
    }
    if (lens.id === lenses.defaultLens &&
        JSON.stringify(urls) !== JSON.stringify(bodyPages)) {
      throw new TypeError("Earth default lens does not match its prepared surface pages.");
    }
    return Object.freeze({ id: lens.id, urls });
  });
  return Object.freeze(banks);
}
