export const browserProfile = Object.freeze({
  id: "pluto",
  inputSelector: ".pluto-input-surface",
  audit: Object.freeze({
    finalScope: "outer",
    fullComparisonWidths: Object.freeze([390, 820, 1200]),
    preparedAssetPairs: Object.freeze([
      Object.freeze({
        one: "/scenes/pluto/pluto-surface.webp",
        two: "/scenes/pluto/pluto-surface@2x.webp",
      }),
      Object.freeze({
        one: "/scenes/pluto/pluto-surface-poles.webp",
        two: "/scenes/pluto/pluto-surface-poles@2x.webp",
      }),
      Object.freeze({
        one: "/scenes/pluto/pluto-curvature.webp",
        two: "/scenes/pluto/pluto-curvature@2x.webp",
      }),
      Object.freeze({
        one: "/scenes/pluto/pluto-starfield-front-standard.webp",
        two: "/scenes/pluto/pluto-starfield-front-standard@2x.webp",
      }),
      Object.freeze({
        one: "/scenes/pluto/pluto-directional-sun.webp",
        two: "/scenes/pluto/pluto-directional-sun@2x.webp",
      }),
    ]),
    lensRace: Object.freeze({
      defaultId: "surface",
      slowId: "topography",
      winnerId: "monochrome",
      slowAsset: "/scenes/pluto/pluto-topography@2x.webp",
      preReadyDisabled: true,
    }),
    retained: Object.freeze({
      lensIds: Object.freeze(["surface", "topography", "monochrome"]),
      speedClicks: 5,
      allowedMountSelectors: Object.freeze([]),
    }),
  }),
  async waitForRuntime(page) {
    await page.waitForFunction(() => window.__pluto?.ready === true);
  },
  pause(page) {
    return page.evaluate(() => window.__pluto.pause());
  },
  camera(page) {
    return page.evaluate(() => {
      const { controlPitch: pitch, zoom } = window.__pluto.camera.state();
      return { pitch, zoom };
    });
  },
  setCamera(page, { pitch, zoom }) {
    return page.evaluate(({ pitch: controlPitch, zoom: nextZoom }) =>
      window.__pluto.camera.setState({ controlPitch, zoom: nextZoom }), {
      pitch,
      zoom,
    });
  },
  bounds(page) {
    return page.evaluate(() => {
      const stats = window.__pluto.camera.stats();
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
    return page.evaluate(() => window.__pluto.assertStableDomIdentity());
  },
  runtimePresent(page) {
    return page.evaluate(() => typeof window.__pluto !== "undefined");
  },
  retainedImages(page) {
    return page.evaluate(() =>
      window.__pluto?.renderStats.textureStats.retainedInteractiveImageCount ??
        null);
  },
  selectedDensity(page) {
    return page.evaluate(() =>
      window.__pluto?.renderStats.textureStats.selectedPreparedDensity ?? null);
  },
  selectLens(page, id) {
    return page.evaluate((lensId) => window.__pluto.lenses.select(lensId), id);
  },
  lens(page) {
    return page.evaluate(() => window.__pluto.lenses.state());
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
      initialNodeCount: window.__pluto.dom.retainedInitialNodeCount,
      stableNodeCount: window.__pluto.stableNodes.length,
    }));
  },
});
