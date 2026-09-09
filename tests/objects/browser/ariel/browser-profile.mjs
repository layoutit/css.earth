import { createObjectBrowserProfile } from "../../../../site/test/object-browser-profile.mjs";
import objectControls from "../../../../src/planets/ariel/prepared/controls.json" with { type: "json" };

export const browserProfile = createObjectBrowserProfile({ id: "ariel", controls: objectControls,
  audit: {
    preparedAssetPairs: [{ one: "/scenes/ariel/ariel-directional-sun.webp", two: "/scenes/ariel/ariel-directional-sun@2x.webp" }],
    canonicalPreparedAssets: ["/scenes/ariel/ariel-normal-surface@2x.webp", "/scenes/ariel/ariel-normal-poles@2x.webp", "/scenes/ariel/ariel-lighting.webp"],
    lensRace: { defaultId: "normal", slowId: "elevation", winnerId: "normal",
      slowAsset: "/scenes/ariel/ariel-elevation-surface@2x.webp", preReadyDisabled: true },
    retained: { lensIds: ["normal", "elevation"], allowedMountSelectors: [] },
  },
});
