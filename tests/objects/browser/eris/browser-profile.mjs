import { createObjectBrowserProfile } from "../../../../site/test/object-browser-profile.mjs";
import objectControls from "../../../../src/planets/eris/prepared/controls.json" with { type: "json" };

export const browserProfile = createObjectBrowserProfile({ id: "eris", controls: objectControls,
  audit: {
    preparedAssetPairs: [{ one: "/scenes/eris/eris-directional-sun.webp", two: "/scenes/eris/eris-directional-sun@2x.webp" }],
    canonicalPreparedAssets: ["/scenes/eris/surface.webp", "/scenes/eris/poles.webp", "/scenes/eris/lighting.webp"],
    retained: { lensIds: objectControls.lenses.controls.map(({ id }) => id), allowedMountSelectors: [] },
  },
});
