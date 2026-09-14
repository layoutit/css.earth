import { browserProfileLensIds, createObjectBrowserProfile } from "../../../../site/test/object-browser-profile.mts";
import objectControls from "../../../../src/objects/rhea/prepared/controls.json" with {type:"json"};

export const browserProfile = createObjectBrowserProfile({ id: "rhea", controls: objectControls,
  audit: {
    preparedAssetPairs: [],
    canonicalPreparedAssets: ["/scenes/rhea/rhea-normal-surface@2x.webp", "/scenes/rhea/rhea-lighting.webp"],
    lensRace: { defaultId: "normal", slowId: "enhanced", winnerId: "normal",
      slowAsset: "/scenes/rhea/rhea-enhanced-surface@2x.webp", preReadyDisabled: true },
    retained: { lensIds: browserProfileLensIds(objectControls), allowedMountSelectors: [] },
  },
});
