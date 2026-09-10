import { browserProfileLensIds, createObjectBrowserProfile } from "../../../../site/test/object-browser-profile.mts";
import objectControls from "../../../../src/planets/ceres/prepared/controls.json" with { type: "json" };

export const browserProfile = createObjectBrowserProfile({ id: "ceres", controls: objectControls,
  audit: {
    preparedAssetPairs: [{ one: "/scenes/ceres/ceres-directional-sun.webp", two: "/scenes/ceres/ceres-directional-sun@2x.webp" }],
    canonicalPreparedAssets: ["/scenes/ceres/ceres-normal-surface@2x.webp", "/scenes/ceres/ceres-normal-poles@2x.webp", "/scenes/ceres/ceres-lighting.webp"],
    lensRace: { defaultId: "normal", slowId: "elevation", winnerId: "enhanced",
      slowAsset: "/scenes/ceres/ceres-elevation-surface@2x.webp", preReadyDisabled: true },
    retained: { lensIds: browserProfileLensIds(objectControls), speedClicks: 5, allowedMountSelectors: [] },
  },
});
