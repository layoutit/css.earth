import { browserProfileLensIds, createObjectBrowserProfile } from "../../../../site/test/object-browser-profile.mts";
import objectControls from "../../../../src/objects/enceladus/prepared/controls.json" with {type:"json"};

export const browserProfile = createObjectBrowserProfile({ id: "enceladus", controls: objectControls,
  audit: {
    preparedAssetPairs: [],
    canonicalPreparedAssets: ["/scenes/enceladus/enceladus-normal-surface@2x.webp", "/scenes/enceladus/enceladus-lighting.webp"],
    lensRace: { defaultId: "normal", slowId: "elevation", winnerId: "normal",
      slowAsset: "/scenes/enceladus/enceladus-elevation-surface@2x.webp", preReadyDisabled: true },
    retained: { lensIds: browserProfileLensIds(objectControls), allowedMountSelectors: [] },
  },
});
