import { createObjectBrowserProfile } from "../../../../site/test/object-browser-profile.mjs";
import { objectControls } from "../site/control-content.mjs";

export const browserProfile = createObjectBrowserProfile({ id: "ceres", controls: objectControls,
  audit: {
    preparedAssetPairs: [{ one: "/scenes/ceres/ceres-directional-sun.webp", two: "/scenes/ceres/ceres-directional-sun@2x.webp" }],
    canonicalPreparedAssets: ["/scenes/ceres/ceres-normal-surface@2x.webp", "/scenes/ceres/ceres-normal-poles@2x.webp", "/scenes/ceres/ceres-lighting.webp"],
    lensRace: { defaultId: "normal", slowId: "enhanced", winnerId: "normal",
      slowAsset: "/scenes/ceres/ceres-enhanced-surface@2x.webp", preReadyDisabled: true },
    retained: { lensIds: objectControls.lenses.controls.map(lens => lens.id), speedClicks: 5, allowedMountSelectors: [] },
  },
});
