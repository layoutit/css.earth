import { createObjectBrowserProfile } from "../../../../site/test/object-browser-profile.mts";
import objectControls from "../../../../src/planets/umbriel/prepared/controls.json" with { type: "json" };

export const browserProfile = createObjectBrowserProfile({ id: "umbriel", controls: objectControls,
  audit: {
    preparedAssetPairs: [{ one: "/scenes/umbriel/umbriel-directional-sun.webp", two: "/scenes/umbriel/umbriel-directional-sun@2x.webp" }],
    canonicalPreparedAssets: ["/scenes/umbriel/umbriel-normal-surface@2x.webp", "/scenes/umbriel/umbriel-normal-poles@2x.webp", "/scenes/umbriel/umbriel-lighting.webp"],
    retained: { lensIds: ["normal"], allowedMountSelectors: [] },
  },
});
