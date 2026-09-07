import { createObjectBrowserProfile } from "../../../../site/test/object-browser-profile.mjs";
import objectControls from "../../../../src/planets/charon/prepared/controls.json" with {type:"json"};

export const browserProfile = createObjectBrowserProfile({ id: "charon", controls: objectControls,
  audit: {
    preparedAssetPairs: [{ one: "/scenes/charon/charon-directional-sun.webp", two: "/scenes/charon/charon-directional-sun@2x.webp" }],
    canonicalPreparedAssets: ["/scenes/charon/charon-normal-surface@2x.webp", "/scenes/charon/charon-normal-poles@2x.webp", "/scenes/charon/charon-lighting.webp"],
    lensRace: { defaultId: "normal", slowId: "elevation", winnerId: "normal",
      slowAsset: "/scenes/charon/charon-elevation-surface@2x.webp", preReadyDisabled: true },
    retained: { lensIds: objectControls.lenses.controls.map(lens => lens.id), allowedMountSelectors: [] },
  },
});
