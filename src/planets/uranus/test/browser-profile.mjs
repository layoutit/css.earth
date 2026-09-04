export const browserProfile = Object.freeze({
  id: "uranus",
  inputSelector: ".uranus-input-surface",
  audit: Object.freeze({
    finalScope: "outer",
    fullComparisonWidths: Object.freeze([390, 820, 1200]),
    preparedAssetPairs: Object.freeze([
      Object.freeze({
        one: "/scenes/uranus/uranus-surface-normal.webp",
        two: "/scenes/uranus/uranus-surface-normal@2x.webp",
      }),
      Object.freeze({
        one: "/scenes/uranus/uranus-fixed-material-normal.webp",
        two: "/scenes/uranus/uranus-fixed-material-normal@2x.webp",
      }),
      Object.freeze({
        one: "/scenes/uranus/uranus-rings.webp",
        two: "/scenes/uranus/uranus-rings@2x.webp",
      }),
      Object.freeze({
        one: "/scenes/uranus/uranus-starfield-front.webp",
        two: "/scenes/uranus/uranus-starfield-front@2x.webp",
      }),
      Object.freeze({
        one: "/scenes/uranus/uranus-directional-sun.webp",
        two: "/scenes/uranus/uranus-directional-sun@2x.webp",
      }),
    ]),
    lensRace: Object.freeze({
      defaultId: "normal",
      slowId: "near-infrared",
      winnerId: "methane",
      slowAsset: "/scenes/uranus/uranus-surface-near-infrared@2x.webp",
      preReadyDisabled: true,
    }),
    retained: Object.freeze({
      lensIds: Object.freeze(["normal", "methane", "near-infrared"]),
      speedClicks: 5,
      allowedMountSelectors: Object.freeze([]),
    }),
  }),
  waitForRuntime(page) {
    return page.waitForFunction(() => window.__uranus?.ready === true);
  },
  pause(page) {
    return page.evaluate(() => window.__uranus.pause());
  },
  playbackRunning(page) {
    return page.locator(".planet-stage").evaluate((stage) =>
      stage.getAnimations({ subtree: true }).some(
        ({ playState }) => playState === "running",
      ));
  },
  camera(page) {
    return page.evaluate(() => {
      const { controlPitch: pitch, zoom } = window.__uranus.camera.state();
      return { pitch, zoom };
    });
  },
  setCamera(page, { pitch, zoom }) {
    return page.evaluate(({ pitch: controlPitch, zoom: nextZoom }) =>
      window.__uranus.camera.setState({ controlPitch, zoom: nextZoom }), { pitch, zoom });
  },
  bounds(page) {
    return page.evaluate(() => {
      const stats = window.__uranus.camera.stats();
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
    return page.evaluate(() => window.__uranus.assertStableDomIdentity());
  },
  runtimePresent(page) {
    return page.evaluate(() => typeof window.__uranus !== "undefined");
  },
  retainedImages(page) {
    return page.evaluate(() => window.__uranus.renderStats.textureStats.retainedInteractiveImageCount);
  },
  selectedDensity(page) {
    return page.evaluate(() => window.__uranus.renderStats.textureStats.selectedPreparedDensity);
  },
  selectLens(page, id) {
    return page.evaluate((lensId) => window.__uranus.lenses.select(lensId), id);
  },
  lens(page) {
    return page.evaluate(() => window.__uranus.lenses.state());
  },
  visibleLens(page) {
    return page.locator(".planet-stage").evaluate((stage) => stage.dataset.lens || "normal");
  },
  pressedLens(page) {
    return page.locator('button[name="lens"][aria-pressed="true"]').getAttribute("value");
  },
  retainedReport(page) {
    return page.evaluate(() => ({
      initialNodeCount: window.__uranus.dom.retainedInitialNodeCount,
      stableNodeCount: window.__uranus.stableNodes.length,
    }));
  },
});
