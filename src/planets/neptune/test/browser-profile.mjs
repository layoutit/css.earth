export const browserProfile = Object.freeze({
  id: "neptune",
  inputSelector: ".neptune-input-surface",
  audit: Object.freeze({
    finalScope: "outer",
    fullComparisonWidths: Object.freeze([390, 820, 1200]),
    preparedAssetPairs: Object.freeze([
      Object.freeze({
        one: "/scenes/neptune/neptune-rings.webp",
        two: "/scenes/neptune/neptune-rings@2x.webp",
      }),
      Object.freeze({
        one: "/scenes/neptune/neptune-surface-normal.webp",
        two: "/scenes/neptune/neptune-surface-normal@2x.webp",
      }),
      Object.freeze({
        one: "/scenes/neptune/neptune-starfield-front.webp",
        two: "/scenes/neptune/neptune-starfield-front@2x.webp",
      }),
      Object.freeze({
        one: "/scenes/neptune/neptune-directional-sun.webp",
        two: "/scenes/neptune/neptune-directional-sun@2x.webp",
      }),
    ]),
    lensRace: Object.freeze({
      defaultId: "normal",
      slowId: "methane",
      winnerId: "near-infrared",
      slowAsset: "/scenes/neptune/neptune-surface-methane@2x.webp",
      preReadyDisabled: true,
    }),
    retained: Object.freeze({
      lensIds: Object.freeze(["normal", "methane", "near-infrared"]),
      speedClicks: 5,
      allowedMountSelectors: Object.freeze([]),
    }),
  }),
  async waitForRuntime(page) {
    await page.waitForFunction(() => window.__neptune?.ready === true);
  },
  pause(page) {
    return page.evaluate(() => window.__neptune.pause());
  },
  camera(page) {
    return page.evaluate(() => {
      const { controlPitch: pitch, zoom } = window.__neptune.camera.state();
      return { pitch, zoom };
    });
  },
  setCamera(page, { pitch, zoom }) {
    return page.evaluate(({ pitch: controlPitch, zoom: nextZoom }) =>
      window.__neptune.camera.setState({ controlPitch, zoom: nextZoom }), {
      pitch,
      zoom,
    });
  },
  bounds(page) {
    return page.evaluate(() => {
      const stats = window.__neptune.camera.stats();
      return {
        minimumPitch: stats.minimumPitchDegrees,
        maximumPitch: stats.maximumPitchDegrees,
        defaultPitch: stats.defaultControlPitchDegrees,
        pitchBounded: stats.pitchBounded,
        minimumZoom: 0.42,
        maximumZoom: 4,
        defaultZoom: 1,
      };
    });
  },
  stable(page) {
    return page.evaluate(() => window.__neptune.assertStableDomIdentity());
  },
  runtimePresent(page) {
    return page.evaluate(() => typeof window.__neptune !== "undefined");
  },
  retainedImages(page) {
    return page.evaluate(() =>
      window.__neptune?.renderStats.textureStats.retainedInteractiveImageCount ?? null);
  },
  selectedDensity(page) {
    return page.evaluate(() =>
      window.__neptune?.renderStats.textureStats.selectedPreparedDensity ?? null);
  },
  selectLens(page, id) {
    return page.evaluate((lensId) => window.__neptune.lenses.select(lensId), id);
  },
  lens(page) {
    return page.evaluate(() => window.__neptune.lenses.state());
  },
  visibleLens(page) {
    return page.locator(".planet-stage").evaluate((stage) =>
      stage.dataset.lens || "normal");
  },
  pressedLens(page) {
    return page.locator('button[name="lens"][aria-pressed="true"]')
      .getAttribute("value");
  },
  retainedReport(page) {
    return page.evaluate(() => ({
      initialNodeCount: window.__neptune.dom.retainedInitialNodeCount,
      stableNodeCount: window.__neptune.stableNodes.length,
    }));
  },
});
