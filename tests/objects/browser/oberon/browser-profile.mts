import { createObjectBrowserProfile } from "../../../../site/test/object-browser-profile.mts";
import objectControls from "../../../../src/planets/oberon/prepared/controls.json" with { type: "json" };

export const browserProfile = createObjectBrowserProfile({ id: "oberon", controls: objectControls,
  audit: {
    preparedAssetPairs: [{ one: "/scenes/oberon/oberon-directional-sun.webp", two: "/scenes/oberon/oberon-directional-sun@2x.webp" }],
    canonicalPreparedAssets: ["/scenes/oberon/oberon-normal-surface@2x.webp", "/scenes/oberon/oberon-normal-poles@2x.webp", "/scenes/oberon/oberon-lighting.webp"],
    retained: { lensIds: ["normal"], allowedMountSelectors: [] },
  },
});
