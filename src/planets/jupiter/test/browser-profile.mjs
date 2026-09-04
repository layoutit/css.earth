export const browserProfile = Object.freeze({
  id: "jupiter",
  inputSelector: ".planet-stage",
  audit: Object.freeze({
    finalScope: "outer",
    fullComparisonWidths: Object.freeze([390, 820, 1200]),
    preparedAssetPairs: Object.freeze([
      Object.freeze({
        one: "/scenes/jupiter/jupiter-surface.webp",
        two: "/scenes/jupiter/jupiter-surface@2x.webp",
      }),
      Object.freeze({
        one: "/scenes/jupiter/jupiter-poles.webp",
        two: "/scenes/jupiter/jupiter-poles@2x.webp",
      }),
      Object.freeze({
        one: "/scenes/jupiter/jupiter-rings.webp",
        two: "/scenes/jupiter/jupiter-rings@2x.webp",
      }),
      Object.freeze({
        one: "/scenes/jupiter/jupiter-starfield-front.webp",
        two: "/scenes/jupiter/jupiter-starfield-front@2x.webp",
      }),
      Object.freeze({
        one: "/scenes/jupiter/jupiter-directional-sun.webp",
        two: "/scenes/jupiter/jupiter-directional-sun@2x.webp",
      }),
    ]),
    lensRace: Object.freeze({
      defaultId: "normal",
      slowId: "ultraviolet",
      winnerId: "methane",
      slowAsset: "/scenes/jupiter/jupiter-lens-ultraviolet@2x.webp",
      preReadyDisabled: false,
    }),
    retained: Object.freeze({
      lensIds: Object.freeze(["normal", "ultraviolet", "methane"]),
      speedClicks: 5,
      allowedMountSelectors: Object.freeze([]),
    }),
  }),
  async waitForRuntime(page) {
    await page.waitForFunction(() => window.__jupiter?.ready === true);
  },
  pause(page) {
    return page.evaluate(() => window.__jupiter.pause());
  },
  camera(page) {
    return page.evaluate(() => window.__jupiter.view());
  },
  setCamera(page, { pitch, zoom }) {
    return page.evaluate((state) => window.__jupiter.setView(state), { pitch, zoom });
  },
  bounds(page) {
    return page.evaluate(() => ({
      minimumPitch: 0,
      maximumPitch: 89,
      defaultPitch: 20.9,
      pitchBounded: false,
      minimumZoom: 0.42,
      maximumZoom: 4,
      defaultZoom: 1.1,
    }));
  },
  stable(page) {
    return page.evaluate(() => window.__jupiter.assertStableDomIdentity());
  },
  runtimePresent(page) {
    return page.evaluate(() => typeof window.__jupiter !== "undefined");
  },
  retainedImages(page) {
    return page.evaluate(() =>
      window.__jupiter?.renderStats.materialCache().retainedImageCount ?? null);
  },
  selectedDensity(page) {
    return page.evaluate(() =>
      window.__jupiter?.renderStats.selectedPreparedDensity ?? null);
  },
  selectLens(page, id) {
    return page.evaluate((lensId) => window.__jupiter.selectLens(lensId), id);
  },
  lens(page) {
    return page.evaluate(() => window.__jupiter.lens());
  },
  visibleLens(page) {
    return page.locator(".planet-stage").evaluate((stage) =>
      stage.dataset.lens || "normal");
  },
  pressedLens(page) {
    return page.locator('button[name="lens"][aria-pressed="true"]').getAttribute(
      "value",
    );
  },
  retainedReport(page) {
    return page.evaluate(() => ({
      initialNodeCount: window.__jupiter.dom.retainedInitialNodeCount,
      stableNodeCount: window.__jupiter.stableNodes.length,
    }));
  },
});
