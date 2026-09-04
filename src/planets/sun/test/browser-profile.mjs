export const browserProfile = Object.freeze({
  id: "sun",
  inputSelector: ".sun-input-surface",
  audit: Object.freeze({
    finalScope: "outer",
    fullComparisonWidths: Object.freeze([390, 820, 1200]),
    preparedAssetPairs: Object.freeze([
      Object.freeze({
        one: "/scenes/sun/sun-corona-photosphere.webp",
        two: "/scenes/sun/sun-corona-photosphere@2x.webp",
      }),
      Object.freeze({
        one: "/scenes/sun/sun-surface-photosphere.webp",
        two: "/scenes/sun/sun-surface-photosphere@2x.webp",
      }),
      Object.freeze({
        one: "/scenes/sun/sun-limb-photosphere.webp",
        two: "/scenes/sun/sun-limb-photosphere@2x.webp",
      }),
      Object.freeze({
        one: "/scenes/sun/sun-starfield-front.webp",
        two: "/scenes/sun/sun-starfield-front@2x.webp",
      }),
    ]),
    lensRace: Object.freeze({
      defaultId: "photosphere",
      slowId: "chromosphere",
      winnerId: "corona",
      slowAsset: "/scenes/sun/sun-surface-chromosphere@2x.webp",
      preReadyDisabled: true,
    }),
    retained: Object.freeze({
      lensIds: Object.freeze(["photosphere", "magnetic", "chromosphere", "corona"]),
      speedClicks: 5,
      allowedMountSelectors: Object.freeze([]),
    }),
  }),
  async waitForRuntime(page) {
    await page.waitForFunction(() => window.__sun?.ready === true);
  },
  pause(page) {
    return page.evaluate(() => window.__sun.pause());
  },
  camera(page) {
    return page.evaluate(() => {
      const { controlPitch: pitch, zoom } = window.__sun.camera.state();
      return { pitch, zoom };
    });
  },
  setCamera(page, { pitch, zoom }) {
    return page.evaluate(({ pitch: controlPitch, zoom: nextZoom }) =>
      window.__sun.camera.setState({ controlPitch, zoom: nextZoom }), {
      pitch,
      zoom,
    });
  },
  bounds(page) {
    return page.evaluate(() => {
      const stats = window.__sun.camera.stats();
      return {
        minimumPitch: stats.minimumPitchDegrees,
        maximumPitch: stats.maximumPitchDegrees,
        defaultPitch: stats.defaultControlPitchDegrees,
        pitchBounded: stats.pitchBounded,
        minimumZoom: 0.42,
        maximumZoom: 4,
        defaultZoom: 1.25,
      };
    });
  },
  stable(page) {
    return page.evaluate(() => window.__sun.assertStableDomIdentity());
  },
  runtimePresent(page) {
    return page.evaluate(() => typeof window.__sun !== "undefined");
  },
  retainedImages(page) {
    return page.evaluate(() =>
      window.__sun?.renderStats.textureStats.retainedInteractiveImageCount ?? null);
  },
  selectedDensity(page) {
    return page.evaluate(() =>
      window.__sun?.renderStats.textureStats.selectedPreparedDensity ?? null);
  },
  selectLens(page, id) {
    return page.evaluate((lensId) => window.__sun.lenses.select(lensId), id);
  },
  lens(page) {
    return page.evaluate(() => window.__sun.lenses.state());
  },
  visibleLens(page) {
    return page.locator(".planet-stage").evaluate((stage) =>
      stage.dataset.lens || "photosphere");
  },
  pressedLens(page) {
    return page.locator('button[name="lens"][aria-pressed="true"]')
      .getAttribute("value");
  },
  retainedReport(page) {
    return page.evaluate(() => ({
      initialNodeCount: window.__sun.dom.retainedInitialNodeCount,
      stableNodeCount: window.__sun.stableNodes.length,
    }));
  },
});
