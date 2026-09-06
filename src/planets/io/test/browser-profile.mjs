import { createObjectBrowserProfile } from "../../../../site/test/object-browser-profile.mjs";
import { objectControls } from "../site/control-content.mjs";

export const browserProfile = createObjectBrowserProfile({ id: "io", controls: objectControls,
  audit: {
    preparedAssetPairs: [{ one: "/scenes/io/io-directional-sun.webp", two: "/scenes/io/io-directional-sun@2x.webp" }],
    canonicalPreparedAssets: ["/scenes/io/io-normal-surface@2x.webp", "/scenes/io/io-normal-poles@2x.webp", "/scenes/io/io-lighting.webp", "/scenes/io/io-parent-jupiter.webp"],
    lensRace: { defaultId: "normal", slowId: "enhanced", winnerId: "normal",
      slowAsset: "/scenes/io/io-enhanced-surface@2x.webp", preReadyDisabled: true },
    retained: { lensIds: objectControls.lenses.controls.map(lens => lens.id), allowedMountSelectors: [] },
  },
});
