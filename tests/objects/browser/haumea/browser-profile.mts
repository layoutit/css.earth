import { browserProfileLensIds, createObjectBrowserProfile } from "../../../../site/test/object-browser-profile.mts";
import objectControls from "../../../../src/objects/haumea/prepared/controls.json" with { type: "json" };

export const browserProfile = createObjectBrowserProfile({ id: "haumea", controls: objectControls,
  audit: {
    preparedAssetPairs: [{ one: "/scenes/haumea/haumea-directional-sun.webp", two: "/scenes/haumea/haumea-directional-sun@2x.webp" }],
    canonicalPreparedAssets: ["/scenes/haumea/surface.webp", "/scenes/haumea/poles.webp", "/scenes/haumea/ring.webp"],
    retained: { lensIds: browserProfileLensIds(objectControls), allowedMountSelectors: [] },
  },
});
