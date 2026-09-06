import { createObjectBrowserProfile } from "../../../../site/test/object-browser-profile.mjs";
import objectControls from "../../../../src/planets/europa/prepared/controls.json" with {type:"json"};

export const browserProfile = createObjectBrowserProfile({ id: "europa", controls: objectControls,
  audit: {
    preparedAssetPairs: [{ one: "/scenes/europa/europa-directional-sun.webp", two: "/scenes/europa/europa-directional-sun@2x.webp" }],
    canonicalPreparedAssets: ["/scenes/europa/europa-normal-surface@2x.webp", "/scenes/europa/europa-normal-poles@2x.webp", "/scenes/europa/europa-lighting.webp", "/scenes/europa/europa-parent-jupiter.webp"],
    lensRace: { defaultId: "normal", slowId: "enhanced", winnerId: "normal",
      slowAsset: "/scenes/europa/europa-enhanced-surface@2x.webp", preReadyDisabled: true },
    retained: { lensIds: objectControls.lenses.controls.map(lens => lens.id), allowedMountSelectors: [] },
  },
});
