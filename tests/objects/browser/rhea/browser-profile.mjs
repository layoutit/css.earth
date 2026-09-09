import { createObjectBrowserProfile } from "../../../../site/test/object-browser-profile.mjs";
import objectControls from "../../../../src/planets/rhea/prepared/controls.json" with {type:"json"};

export const browserProfile = createObjectBrowserProfile({ id: "rhea", controls: objectControls,
  audit: {
    preparedAssetPairs: [{ one: "/scenes/rhea/rhea-directional-sun.webp", two: "/scenes/rhea/rhea-directional-sun@2x.webp" }],
    canonicalPreparedAssets: ["/scenes/rhea/rhea-normal-surface@2x.webp", "/scenes/rhea/rhea-lighting.webp"],
    lensRace: { defaultId: "normal", slowId: "enhanced", winnerId: "normal",
      slowAsset: "/scenes/rhea/rhea-enhanced-surface@2x.webp", preReadyDisabled: true },
    retained: { lensIds: objectControls.lenses.controls.map(lens => lens.id), allowedMountSelectors: [] },
  },
});
