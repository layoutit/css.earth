import { browserProfileLensIds, createObjectBrowserProfile } from "../../../../site/test/object-browser-profile.mts";
import objectControls from "../../../../src/planets/triton/prepared/controls.json" with {type:"json"};

export const browserProfile = createObjectBrowserProfile({ id: "triton", controls: objectControls,
  audit: {
    preparedAssetPairs: [{ one: "/scenes/triton/triton-directional-sun.webp", two: "/scenes/triton/triton-directional-sun@2x.webp" }],
    canonicalPreparedAssets: ["/scenes/triton/triton-normal-surface@2x.webp", "/scenes/triton/triton-normal-poles@2x.webp", "/scenes/triton/triton-lighting.webp"],
    lensRace: { defaultId: "normal", slowId: "enhanced", winnerId: "normal",
      slowAsset: "/scenes/triton/triton-enhanced-surface@2x.webp", preReadyDisabled: true },
    retained: { lensIds: browserProfileLensIds(objectControls), allowedMountSelectors: [] },
  },
});
