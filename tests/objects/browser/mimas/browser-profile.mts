import { browserProfileLensIds, createObjectBrowserProfile } from "../../../../site/test/object-browser-profile.mts";
import objectControls from "../../../../src/objects/mimas/prepared/controls.json" with {type:"json"};

export const browserProfile = createObjectBrowserProfile({ id: "mimas", controls: objectControls,
  audit: {
    preparedAssetPairs: [],
    canonicalPreparedAssets: ["/scenes/mimas/mimas-normal-surface@2x.webp", "/scenes/mimas/mimas-lighting.webp"],
    lensRace: { defaultId: "normal", slowId: "enhanced", winnerId: "normal",
      slowAsset: "/scenes/mimas/mimas-enhanced-surface@2x.webp", preReadyDisabled: true },
    retained: { lensIds: browserProfileLensIds(objectControls), allowedMountSelectors: [] },
  },
});
