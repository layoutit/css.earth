export const browserProfile = Object.freeze({
  id: "saturn",
  inputSelector: ".saturn-input-surface",
  audit: Object.freeze({
    finalScope: "outer",
    fullComparisonWidths: Object.freeze([390, 820, 1200]),
    preparedAssetPairs: Object.freeze([
      Object.freeze({
        one: "/scenes/saturn/saturn-rings.webp",
        two: "/scenes/saturn/saturn-rings@2x.webp",
      }),
      Object.freeze({
        one: "/scenes/saturn/saturn-starfield-front.webp",
        two: "/scenes/saturn/saturn-starfield-front@2x.webp",
      }),
      Object.freeze({
        one: "/scenes/saturn/saturn-directional-sun.webp",
        two: "/scenes/saturn/saturn-directional-sun@2x.webp",
      }),
    ]),
    lensRace: Object.freeze({
      defaultId: "normal",
      slowId: "ultraviolet",
      winnerId: "methane",
      slowAsset: "/scenes/saturn/saturn-surface-ultraviolet@2x.webp",
      preReadyDisabled: true,
    }),
    retained: Object.freeze({
      lensIds: Object.freeze([
        "normal",
        "ultraviolet",
        "methane",
        "thermal",
        "cross-section",
      ]),
      speedClicks: 5,
      allowedMountSelectors: Object.freeze([]),
    }),
  }),
  async waitForRuntime(page) {
    await page.waitForFunction(() => window.__saturn?.ready === true);
  },
  pause(page) {
    return page.evaluate(() => window.__saturn.pause());
  },
  camera(page) {
    return page.evaluate(() => {
      const { controlPitch: pitch, zoom } = window.__saturn.camera.state();
      return { pitch, zoom };
    });
  },
  setCamera(page, { pitch, zoom }) {
    return page.evaluate(({ pitch: controlPitch, zoom: nextZoom }) =>
      window.__saturn.camera.setState({ controlPitch, zoom: nextZoom }), {
      pitch,
      zoom,
    });
  },
  bounds(page) {
    return page.evaluate(() => {
      const stats = window.__saturn.camera.stats();
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
    return page.evaluate(() => window.__saturn.assertStableDomIdentity());
  },
  runtimePresent(page) {
    return page.evaluate(() => typeof window.__saturn !== "undefined");
  },
  retainedImages(page) {
    return page.evaluate(() =>
      window.__saturn?.renderStats.textureStats.retainedInteractiveImageCount ?? null);
  },
  selectedDensity(page) {
    return page.evaluate(() =>
      window.__saturn?.renderStats.textureStats.selectedPreparedDensity ?? null);
  },
  selectLens(page, id) {
    return page.evaluate(async (lensId) => {
      if (lensId !== "cross-section" &&
          window.__saturn.lenses.state().interior) {
        await window.__saturn.lenses.select("cross-section");
      }
      await window.__saturn.lenses.select(lensId);
    }, id);
  },
  lens(page) {
    return page.evaluate(() => {
      const state = window.__saturn.lenses.state();
      return state.interior ? { ...state, id: "cross-section" } : state;
    });
  },
  visibleLens(page) {
    return page.locator(".planet-stage").evaluate((stage) =>
      stage.dataset.view === "interior"
        ? "cross-section"
        : stage.dataset.lens || "normal");
  },
  pressedLens(page) {
    return page.locator(".planet-stage").evaluate((stage) => {
      if (stage.dataset.view === "interior") return "cross-section";
      return document.querySelector(
        'button[name="lens"]:not([value="cross-section"])' +
        '[aria-pressed="true"]',
      )?.value ?? null;
    });
  },
  retainedReport(page) {
    return page.evaluate(() => ({
      initialNodeCount: window.__saturn.dom.retainedInitialNodeCount,
      stableNodeCount: window.__saturn.stableNodes.length,
    }));
  },
});
