import { createObjectBrowserProfile } from "../../../../site/test/object-browser-profile.mts";
import { readPreparedFixture } from "../../fixtures.mts";
const objectControls = await readPreparedFixture("ceres", "controls");

export const browserProfile = createObjectBrowserProfile({
  id: "ceres", controls: objectControls,
  audit: Object.freeze({
    preparedAssetPairs: Object.freeze([
      Object.freeze({ one: "/scenes/ceres/ceres-normal.webp", two: "/scenes/ceres/ceres-normal@2x.webp" }),
      Object.freeze({ one: "/scenes/ceres/ceres-poles-normal.webp", two: "/scenes/ceres/ceres-poles-normal@2x.webp" }),
      Object.freeze({ one: "/scenes/ceres/ceres-starfield-front.webp", two: "/scenes/ceres/ceres-starfield-front@2x.webp" }),
      ]),
    lensRace: Object.freeze({
      defaultId: "normal",
      slowId: "enhanced",
      winnerId: "elevation",
      slowAsset: "/scenes/ceres/ceres-enhanced@2x.webp",
      preReadyDisabled: true,
    }),
    retained: Object.freeze({
      lensIds: Object.freeze(["normal","enhanced","elevation"]),
      speedClicks: 5,
      allowedMountSelectors: Object.freeze([]),
    }),
  }),
});
