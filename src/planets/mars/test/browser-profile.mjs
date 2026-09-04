import { PREPARED_MARS_LIGHTING } from "../runtime/preparedLighting.mjs";

const materialOne = PREPARED_MARS_LIGHTING.banks["1"];
const materialTwo = PREPARED_MARS_LIGHTING.banks["2"];
const defaultMaterialOne = materialOne.rows[materialOne.transport.defaultRow];
const defaultMaterialTwo = materialTwo.rows[materialTwo.transport.defaultRow];

export const browserProfile = Object.freeze({
  id: "mars",
  inputSelector: ".planet-stage",
  audit: Object.freeze({
    finalScope: "outer",
    fullComparisonWidths: Object.freeze([390, 820, 1200]),
    preparedAssetPairs: Object.freeze([
      Object.freeze({
        one: "/scenes/mars/mars-surface.webp",
        two: "/scenes/mars/mars-surface@2x.webp",
      }),
      Object.freeze({
        one: "/scenes/mars/mars-poles.webp",
        two: "/scenes/mars/mars-poles@2x.webp",
      }),
      Object.freeze({
        one: defaultMaterialOne.url,
        two: defaultMaterialTwo.url,
      }),
      Object.freeze({
        one: "/scenes/mars/mars-starfield-front.webp",
        two: "/scenes/mars/mars-starfield-front@2x.webp",
      }),
      Object.freeze({
        one: "/scenes/mars/mars-directional-sun.webp",
        two: "/scenes/mars/mars-directional-sun@2x.webp",
      }),
    ]),
    lensRace: Object.freeze({
      defaultId: "normal",
      slowId: "elevation",
      winnerId: "thermal",
      slowAsset: "/scenes/mars/mars-lens-elevation@2x.webp",
      preReadyDisabled: false,
    }),
    retained: Object.freeze({
      lensIds: Object.freeze(["normal", "elevation", "thermal"]),
      speedClicks: 5,
      allowedMountSelectors: Object.freeze([]),
    }),
  }),
  async waitForRuntime(page) {
    await page.waitForFunction(() => window.__mars?.ready === true);
  },
  pause(page) {
    return page.evaluate(() => window.__mars.pause());
  },
  camera(page) {
    return page.evaluate(() => window.__mars.view());
  },
  setCamera(page, { pitch, zoom }) {
    return page.evaluate((state) => window.__mars.setView(state), { pitch, zoom });
  },
  bounds(page) {
    return page.evaluate(() => {
      const stats = window.__mars.camera.stats();
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
    return page.evaluate(() => window.__mars.assertStableDomIdentity());
  },
  runtimePresent(page) {
    return page.evaluate(() => typeof window.__mars !== "undefined");
  },
  retainedImages(page) {
    return page.evaluate(() =>
      window.__mars?.renderStats.materialCache().retainedImageCount ?? null);
  },
  selectedDensity(page) {
    return page.evaluate(() =>
      window.__mars?.renderStats.selectedPreparedDensity ?? null);
  },
  selectLens(page, id) {
    return page.evaluate((lensId) => window.__mars.selectLens(lensId), id);
  },
  lens(page) {
    return page.evaluate(() => window.__mars.lens());
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
      initialNodeCount: window.__mars.dom.retainedInitialNodeCount,
      stableNodeCount: window.__mars.stableNodes.length,
    }));
  },
});
