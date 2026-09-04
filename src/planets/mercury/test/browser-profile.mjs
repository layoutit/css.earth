export const browserProfile = Object.freeze({
  id: "mercury",
  inputSelector: ".mercury-input-surface",
  audit: Object.freeze({
    finalScope: "outer",
    fullComparisonWidths: Object.freeze([390, 820, 1200]),
    preparedAssetPairs: Object.freeze([
      Object.freeze({
        one: "/scenes/mercury/mercury-surface-normal.webp",
        two: "/scenes/mercury/mercury-surface-normal@2x.webp",
      }),
      Object.freeze({
        one: "/scenes/mercury/mercury-poles.webp",
        two: "/scenes/mercury/mercury-poles@2x.webp",
      }),
      Object.freeze({
        one: "/scenes/mercury/mercury-lighting-1x-row-28.webp",
        two: "/scenes/mercury/mercury-lighting-2x-row-28.webp",
      }),
      Object.freeze({
        one: "/scenes/mercury/mercury-starfield-front.webp",
        two: "/scenes/mercury/mercury-starfield-front@2x.webp",
      }),
      Object.freeze({
        one: "/scenes/mercury/mercury-directional-sun.webp",
        two: "/scenes/mercury/mercury-directional-sun@2x.webp",
      }),
    ]),
    lensRace: Object.freeze({
      defaultId: "normal",
      slowId: "enhanced",
      winnerId: "topography",
      slowAsset: "/scenes/mercury/mercury-surface-enhanced@2x.webp",
      preReadyDisabled: true,
    }),
    retained: Object.freeze({
      lensIds: Object.freeze([
        "normal",
        "enhanced",
        "topography",
        "interior",
      ]),
      speedClicks: 5,
      allowedMountSelectors: Object.freeze([]),
    }),
  }),
  async waitForRuntime(page) {
    await page.waitForFunction(() => window.__mercury?.ready === true);
  },
  pause(page) {
    return page.evaluate(() => window.__mercury.pause());
  },
  playbackRunning(page) {
    return page.locator(".planet-stage").evaluate((stage) =>
      stage.getAnimations({ subtree: true }).some(
        ({ playState }) => playState === "running",
      ));
  },
  camera(page) {
    return page.evaluate(() => {
      const { controlPitch: pitch, zoom } = window.__mercury.camera.state();
      return { pitch, zoom };
    });
  },
  setCamera(page, { pitch, zoom }) {
    return page.evaluate(({ pitch: controlPitch, zoom: nextZoom }) =>
      window.__mercury.camera.setState({ controlPitch, zoom: nextZoom }), {
      pitch,
      zoom,
    });
  },
  bounds(page) {
    return page.evaluate(() => {
      const stats = window.__mercury.camera.stats();
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
    return page.evaluate(() => window.__mercury.assertStableDomIdentity());
  },
  runtimePresent(page) {
    return page.evaluate(() => typeof window.__mercury !== "undefined");
  },
  retainedImages(page) {
    return page.evaluate(() =>
      window.__mercury?.renderStats.textureStats.retainedInteractiveImageCount ??
        null);
  },
  selectedDensity(page) {
    return page.evaluate(() =>
      window.__mercury?.renderStats.textureStats.selectedPreparedDensity ?? null);
  },
  selectLens(page, id) {
    return page.evaluate((lensId) => window.__mercury.lenses.select(lensId), id);
  },
  lens(page) {
    return page.evaluate(() => window.__mercury.lenses.state());
  },
  visibleLens(page) {
    return page.locator(".planet-stage").evaluate((stage) =>
      stage.dataset.view === "interior"
        ? "interior"
        : stage.dataset.lens || "normal");
  },
  pressedLens(page) {
    return page.locator('button[name="lens"][aria-pressed="true"]')
      .getAttribute("value");
  },
  retainedReport(page) {
    return page.evaluate(() => ({
      initialNodeCount: window.__mercury.dom.retainedInitialNodeCount,
      stableNodeCount: window.__mercury.stableNodes.length,
    }));
  },
});
