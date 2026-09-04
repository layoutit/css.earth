export const browserProfile = Object.freeze({
  id: "earth",
  inputSelector: ".earth-input-surface",
  audit: Object.freeze({
    finalScope: "outer",
    fullComparisonWidths: Object.freeze([390, 820, 1200]),
    canonicalPreparedAssets: Object.freeze([
      "/scenes/earth/earth-surface.webp",
      "/scenes/earth/earth-surface-poles.webp",
    ]),
    preparedAssetPairs: Object.freeze([
      Object.freeze({ one: "/scenes/earth/earth-starfield-front.webp", two: "/scenes/earth/earth-starfield-front@2x.webp" }),
      Object.freeze({ one: "/scenes/earth/earth-directional-sun.webp", two: "/scenes/earth/earth-directional-sun@2x.webp" }),
    ]),
    lensRace: Object.freeze({
      defaultId: "normal",
      slowId: "topography",
      winnerId: "night-lights",
      slowAsset: "/scenes/earth/earth-topography.webp",
      preReadyDisabled: true,
    }),
    retained: Object.freeze({
      lensIds: Object.freeze(["normal", "topography", "night-lights", "cross-section"]),
      speedClicks: 5,
      allowedMountSelectors: Object.freeze([]),
    }),
  }),
  async waitForRuntime(page) { await page.waitForFunction(() => window.__earth?.ready === true); },
  pause(page) { return page.evaluate(() => window.__earth.pause()); },
  camera(page) {
    return page.evaluate(() => {
      const { controlPitch: pitch, zoom } = window.__earth.camera.state();
      return { pitch, zoom };
    });
  },
  setCamera(page, { pitch, zoom }) {
    return page.evaluate(({ pitch: controlPitch, zoom: nextZoom }) => window.__earth.camera.setState({ controlPitch, zoom: nextZoom }), { pitch, zoom });
  },
  bounds(page) {
    return page.evaluate(() => {
      const stats = window.__earth.camera.stats();
      return {
        minimumPitch: stats.minimumPitchDegrees,
        maximumPitch: stats.maximumPitchDegrees,
        defaultPitch: stats.defaultControlPitchDegrees,
        pitchBounded: stats.pitchBounded,
        minimumZoom: stats.minimumZoom,
        maximumZoom: stats.maximumZoom,
        defaultZoom: stats.defaultZoom,
      };
    });
  },
  stable(page) { return page.evaluate(() => window.__earth.assertStableDomIdentity()); },
  runtimePresent(page) { return page.evaluate(() => typeof window.__earth !== "undefined"); },
  retainedImages(page) { return page.evaluate(() => window.__earth?.renderStats.textureStats.retainedInteractiveImageCount ?? null); },
  selectedDensity(page) { return page.evaluate(() => window.__earth?.renderStats.textureStats.selectedPreparedDensity ?? null); },
  selectLens(page, id) { return page.evaluate((lensId) => window.__earth.lenses.select(lensId), id); },
  lens(page) { return page.evaluate(() => window.__earth.lenses.state()); },
  visibleLens(page) {
    return page.locator(".planet-stage").evaluate((stage) => stage.dataset.view === "interior" ? "cross-section" : stage.dataset.lens || "normal");
  },
  pressedLens(page) { return page.locator('button[name="lens"][aria-pressed="true"]').getAttribute("value"); },
  retainedReport(page) {
    return page.evaluate(() => ({
      initialNodeCount: window.__earth.dom.retainedInitialNodeCount,
      stableNodeCount: window.__earth.stableNodes.length,
    }));
  },
});
