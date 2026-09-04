export const browserProfile = Object.freeze({
  id: "moon",
  inputSelector: ".moon-input-surface",
  audit: Object.freeze({
    finalScope: "outer",
    fullComparisonWidths: Object.freeze([390, 820, 1200]),
    preparedAssetPairs: Object.freeze([
      Object.freeze({
        one: "/scenes/moon/moon-surface.webp",
        two: "/scenes/moon/moon-surface@2x.webp",
      }),
      Object.freeze({
        one: "/scenes/moon/moon-surface-poles.webp",
        two: "/scenes/moon/moon-surface-poles@2x.webp",
      }),
      Object.freeze({
        one: "/scenes/moon/moon-curvature.webp",
        two: "/scenes/moon/moon-curvature@2x.webp",
      }),
      Object.freeze({
        one: "/scenes/moon/moon-starfield-front-standard.webp",
        two: "/scenes/moon/moon-starfield-front-standard@2x.webp",
      }),
      Object.freeze({
        one: "/scenes/moon/moon-directional-sun.webp",
        two: "/scenes/moon/moon-directional-sun@2x.webp",
      }),
    ]),
    lensRace: Object.freeze({
      defaultId: "surface",
      slowId: "topography",
      winnerId: "crust",
      slowAsset: "/scenes/moon/moon-topography@2x.webp",
      preReadyDisabled: true,
    }),
    retained: Object.freeze({
      lensIds: Object.freeze(["surface", "topography", "crust"]),
      speedClicks: 5,
      allowedMountSelectors: Object.freeze([]),
    }),
  }),
  async waitForRuntime(page) {
    await page.waitForFunction(() => window.__moon?.ready === true);
  },
  pause(page) {
    return page.evaluate(() => window.__moon.pause());
  },
  camera(page) {
    return page.evaluate(() => {
      const { controlPitch: pitch, zoom } = window.__moon.camera.state();
      return { pitch, zoom };
    });
  },
  setCamera(page, { pitch, zoom }) {
    return page.evaluate(({ pitch: controlPitch, zoom: nextZoom }) =>
      window.__moon.camera.setState({ controlPitch, zoom: nextZoom }), {
      pitch,
      zoom,
    });
  },
  bounds(page) {
    return page.evaluate(() => {
      const stats = window.__moon.camera.stats();
      return {
        minimumPitch: stats.minimumPitchDegrees,
        maximumPitch: stats.maximumPitchDegrees,
        defaultPitch: stats.defaultControlPitchDegrees,
        pitchBounded: stats.pitchBounded,
        minimumZoom: 0.42,
        maximumZoom: 4,
        defaultZoom: 1.1,
      };
    });
  },
  stable(page) {
    return page.evaluate(() => window.__moon.assertStableDomIdentity());
  },
  runtimePresent(page) {
    return page.evaluate(() => typeof window.__moon !== "undefined");
  },
  retainedImages(page) {
    return page.evaluate(() =>
      window.__moon?.renderStats.textureStats.retainedInteractiveImageCount ??
        null);
  },
  selectedDensity(page) {
    return page.evaluate(() =>
      window.__moon?.renderStats.textureStats.selectedPreparedDensity ?? null);
  },
  selectLens(page, id) {
    return page.evaluate((lensId) => window.__moon.lenses.select(lensId), id);
  },
  lens(page) {
    return page.evaluate(() => window.__moon.lenses.state());
  },
  visibleLens(page) {
    return page.locator(".planet-stage").evaluate((stage) =>
      stage.dataset.lens || "surface");
  },
  pressedLens(page) {
    return page.locator('button[name="lens"][aria-pressed="true"]')
      .getAttribute("value");
  },
  retainedReport(page) {
    return page.evaluate(() => ({
      initialNodeCount: window.__moon.dom.retainedInitialNodeCount,
      stableNodeCount: window.__moon.stableNodes.length,
    }));
  },
});
