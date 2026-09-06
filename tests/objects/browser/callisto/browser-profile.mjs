import { createObjectBrowserProfile } from "../../../../site/test/object-browser-profile.mjs";
import objectControls from "../../../../src/planets/callisto/prepared/controls.json" with {type:"json"};

export const browserProfile = createObjectBrowserProfile({ id: "callisto", controls: objectControls,
  audit: {
    preparedAssetPairs: [{ one: "/scenes/callisto/callisto-directional-sun.webp", two: "/scenes/callisto/callisto-directional-sun@2x.webp" }],
    canonicalPreparedAssets: ["/scenes/callisto/callisto-normal-surface@2x.webp", "/scenes/callisto/callisto-normal-poles@2x.webp", "/scenes/callisto/callisto-lighting.webp", "/scenes/callisto/callisto-parent-jupiter.webp"],
    retained: { lensIds: objectControls.lenses.controls.map(lens => lens.id), allowedMountSelectors: [] },
  },
});
