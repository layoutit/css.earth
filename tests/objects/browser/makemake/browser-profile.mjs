import { createObjectBrowserProfile } from "../../../../site/test/object-browser-profile.mjs";
import objectControls from "../../../../src/planets/makemake/prepared/controls.json" with { type: "json" };

export const browserProfile = createObjectBrowserProfile({ id: "makemake", controls: objectControls,
  audit: {
    preparedAssetPairs: [{ one: "/scenes/makemake/makemake-directional-sun.webp", two: "/scenes/makemake/makemake-directional-sun@2x.webp" }],
    canonicalPreparedAssets: ["/scenes/makemake/surface.webp", "/scenes/makemake/poles.webp", "/scenes/makemake/lighting.webp"],
    retained: { lensIds: objectControls.lenses.controls.map(({ id }) => id), allowedMountSelectors: [] },
  },
});
