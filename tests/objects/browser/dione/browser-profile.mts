import { browserProfileLensIds, createObjectBrowserProfile } from "../../../../site/test/object-browser-profile.mts";
import objectControls from "../../../../src/planets/dione/prepared/controls.json" with {type:"json"};

export const browserProfile = createObjectBrowserProfile({ id: "dione", controls: objectControls,
  audit: {
    preparedAssetPairs: [{ one: "/scenes/dione/dione-directional-sun.webp", two: "/scenes/dione/dione-directional-sun@2x.webp" }],
    canonicalPreparedAssets: ["/scenes/dione/dione-normal-surface@2x.webp", "/scenes/dione/dione-lighting.webp"],
    lensRace: { defaultId: "normal", slowId: "enhanced", winnerId: "normal",
      slowAsset: "/scenes/dione/dione-enhanced-surface@2x.webp", preReadyDisabled: true },
    retained: { lensIds: browserProfileLensIds(objectControls), allowedMountSelectors: [] },
  },
});
