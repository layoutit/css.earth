import { browserProfileLensIds, createObjectBrowserProfile } from "../../../../site/test/object-browser-profile.mts";
import objectControls from "../../../../src/planets/iapetus/prepared/controls.json" with {type:"json"};

export const browserProfile = createObjectBrowserProfile({ id: "iapetus", controls: objectControls,
  audit: {
    preparedAssetPairs: [{ one: "/scenes/iapetus/iapetus-directional-sun.webp", two: "/scenes/iapetus/iapetus-directional-sun@2x.webp" }],
    canonicalPreparedAssets: ["/scenes/iapetus/iapetus-normal-surface@2x.webp", "/scenes/iapetus/iapetus-normal-poles@2x.webp", "/scenes/iapetus/iapetus-lighting.webp"],
    lensRace: { defaultId: "normal", slowId: "enhanced", winnerId: "normal",
      slowAsset: "/scenes/iapetus/iapetus-enhanced-surface@2x.webp", preReadyDisabled: true },
    retained: { lensIds: browserProfileLensIds(objectControls), allowedMountSelectors: [] },
  },
});
