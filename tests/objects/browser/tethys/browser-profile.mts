import { browserProfileLensIds, createObjectBrowserProfile } from "../../../../site/test/object-browser-profile.mts";
import objectControls from "../../../../src/objects/tethys/prepared/controls.json" with {type:"json"};

export const browserProfile = createObjectBrowserProfile({ id: "tethys", controls: objectControls,
  audit: {
    canonicalPreparedAssets: ["/scenes/tethys/tethys-normal-surface@2x.webp", "/scenes/tethys/tethys-lighting.webp"],
    lensRace: { defaultId: "normal", slowId: "enhanced", winnerId: "normal",
      slowAsset: "/scenes/tethys/tethys-enhanced-surface@2x.webp", preReadyDisabled: true },
    retained: { lensIds: browserProfileLensIds(objectControls), allowedMountSelectors: [] },
  },
});
