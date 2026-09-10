import { browserProfileLensIds, createObjectBrowserProfile } from "../../../../site/test/object-browser-profile.mts";
import objectControls from "../../../../src/planets/titan/prepared/controls.json" with {type:"json"};

export const browserProfile = createObjectBrowserProfile({ id: "titan", controls: objectControls,
  audit: {
    preparedAssetPairs: [{ one: "/scenes/titan/titan-directional-sun.webp", two: "/scenes/titan/titan-directional-sun@2x.webp" }],
    canonicalPreparedAssets: ["/scenes/titan/titan-normal-surface@2x.webp", "/scenes/titan/titan-normal-poles@2x.webp", "/scenes/titan/titan-lighting.webp"],
    lensRace: { defaultId: "normal", slowId: "radar", winnerId: "normal",
      slowAsset: "/scenes/titan/titan-radar-surface@2x.webp", preReadyDisabled: true },
    retained: { lensIds: browserProfileLensIds(objectControls), allowedMountSelectors: [] },
  },
});
