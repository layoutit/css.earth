import { createObjectBrowserProfile } from "../../../../site/test/object-browser-profile.mjs";
import objectControls from "../../../../src/planets/titania/prepared/controls.json" with { type: "json" };

export const browserProfile = createObjectBrowserProfile({ id: "titania", controls: objectControls,
  audit: {
    preparedAssetPairs: [{ one: "/scenes/titania/titania-directional-sun.webp", two: "/scenes/titania/titania-directional-sun@2x.webp" }],
    canonicalPreparedAssets: ["/scenes/titania/titania-normal-surface@2x.webp", "/scenes/titania/titania-normal-poles@2x.webp", "/scenes/titania/titania-lighting.webp"],
    lensRace: { defaultId: "normal", slowId: "elevation", winnerId: "normal",
      slowAsset: "/scenes/titania/titania-elevation-surface@2x.webp", preReadyDisabled: true },
    retained: { lensIds: objectControls.lenses.controls.map(lens => lens.id), allowedMountSelectors: [] },
  },
});
