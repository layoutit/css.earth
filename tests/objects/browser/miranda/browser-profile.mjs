import { createObjectBrowserProfile } from "../../../../site/test/object-browser-profile.mjs";
import objectControls from "../../../../src/planets/miranda/prepared/controls.json" with { type: "json" };

export const browserProfile = createObjectBrowserProfile({ id: "miranda", controls: objectControls,
  audit: {
    preparedAssetPairs: [{ one: "/scenes/miranda/miranda-directional-sun.webp", two: "/scenes/miranda/miranda-directional-sun@2x.webp" }],
    canonicalPreparedAssets: ["/scenes/miranda/miranda-normal-surface@2x.webp", "/scenes/miranda/miranda-normal-poles@2x.webp", "/scenes/miranda/miranda-lighting.webp"],
    retained: { lensIds: ["normal"], allowedMountSelectors: [] },
  },
});
