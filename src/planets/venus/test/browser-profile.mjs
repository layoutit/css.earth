export const browserProfile = Object.freeze({
  id: "venus",
  inputSelector: ".venus-input-surface",
  audit: Object.freeze({
    finalScope: "outer",
    fullComparisonWidths: Object.freeze([390, 820, 1200]),
    preparedAssetPairs: Object.freeze([
      Object.freeze({
        one: "/scenes/venus/venus-clouds.webp",
        two: "/scenes/venus/venus-clouds@2x.webp",
      }),
      Object.freeze({
        one: "/scenes/venus/venus-poles-clouds.webp",
        two: "/scenes/venus/venus-poles-clouds@2x.webp",
      }),
      Object.freeze({
        one: "/scenes/venus/venus-material.webp",
        two: "/scenes/venus/venus-material@2x.webp",
      }),
      Object.freeze({
        one: "/scenes/venus/venus-lighting.webp",
        two: "/scenes/venus/venus-lighting@2x.webp",
      }),
      Object.freeze({
        one: "/scenes/venus/venus-starfield-front.webp",
        two: "/scenes/venus/venus-starfield-front@2x.webp",
      }),
      Object.freeze({
        one: "/scenes/venus/venus-directional-sun.webp",
        two: "/scenes/venus/venus-directional-sun@2x.webp",
      }),
    ]),
    lensRace: Object.freeze({
      defaultId: "clouds",
      slowId: "radar",
      winnerId: "elevation",
      slowAsset: "/scenes/venus/venus-radar@2x.webp",
      preReadyDisabled: true,
    }),
    retained: Object.freeze({
      lensIds: Object.freeze(["clouds", "radar", "elevation"]),
      speedClicks: 5,
      allowedMountSelectors: Object.freeze([]),
    }),
  }),
  async waitForRuntime(page) {
    await page.waitForFunction(() => window.__venus?.ready === true);
  },
  pause(page) {
    return page.evaluate(() => window.__venus.pause());
  },
  camera(page) {
    return page.evaluate(() => {
      const { controlPitch: pitch, zoom } = window.__venus.camera.state();
      return { pitch, zoom };
    });
  },
  setCamera(page, { pitch, zoom }) {
    return page.evaluate(({ pitch: controlPitch, zoom: nextZoom }) =>
      window.__venus.camera.setState({ controlPitch, zoom: nextZoom }), {
      pitch,
      zoom,
    });
  },
  bounds(page) {
    return page.evaluate(() => {
      const stats = window.__venus.camera.stats();
      return {
        minimumPitch: stats.minimumPitchDegrees,
        maximumPitch: stats.maximumPitchDegrees,
        defaultPitch: stats.defaultControlPitchDegrees,
        pitchBounded: stats.pitchBounded,
        minimumZoom: 0.42,
        maximumZoom: 4,
        defaultZoom: 1.9,
      };
    });
  },
  stable(page) {
    return page.evaluate(() => window.__venus.assertStableDomIdentity());
  },
  runtimePresent(page) {
    return page.evaluate(() => typeof window.__venus !== "undefined");
  },
  retainedImages(page) {
    return page.evaluate(() =>
      window.__venus?.renderStats.textureStats.retainedInteractiveImageCount ?? null);
  },
  selectedDensity(page) {
    return page.evaluate(() =>
      window.__venus?.renderStats.textureStats.selectedPreparedDensity ?? null);
  },
  selectLens(page, id) {
    return page.evaluate((lensId) => window.__venus.lenses.select(lensId), id);
  },
  lens(page) {
    return page.evaluate(() => window.__venus.lenses.state());
  },
  visibleLens(page) {
    return page.locator(".planet-stage").evaluate((stage) =>
      stage.dataset.lens || "clouds");
  },
  pressedLens(page) {
    return page.locator('button[name="lens"][aria-pressed="true"]')
      .getAttribute("value");
  },
  retainedReport(page) {
    return page.evaluate(() => ({
      initialNodeCount: window.__venus.dom.retainedInitialNodeCount,
      stableNodeCount: window.__venus.stableNodes.length,
    }));
  },
});
