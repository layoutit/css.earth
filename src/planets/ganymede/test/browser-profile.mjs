import { createObjectBrowserProfile } from "../../../../site/test/object-browser-profile.mjs";
import { objectControls } from "../site/control-content.mjs";

export const browserProfile = createObjectBrowserProfile({ id: "ganymede", controls: objectControls,
  audit: {
    preparedAssetPairs: [{ one: "/scenes/ganymede/ganymede-directional-sun.webp", two: "/scenes/ganymede/ganymede-directional-sun@2x.webp" }],
    canonicalPreparedAssets: ["/scenes/ganymede/ganymede-normal-surface@2x.webp", "/scenes/ganymede/ganymede-normal-poles@2x.webp", "/scenes/ganymede/ganymede-lighting.webp", "/scenes/ganymede/ganymede-parent-jupiter.webp"],
    lensRace: { defaultId: "normal", slowId: "enhanced", winnerId: "normal",
      slowAsset: "/scenes/ganymede/ganymede-enhanced-surface@2x.webp", preReadyDisabled: true },
    retained: { lensIds: objectControls.lenses.controls.map(lens => lens.id), allowedMountSelectors: [] },
  },
});
