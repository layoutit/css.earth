import { browserProfileLensIds, createObjectBrowserProfile } from "../../../../site/test/object-browser-profile.mts";
import objectControls from "../../../../src/planets/rhea/prepared/controls.json" with {type:"json"};

export const browserProfile = createObjectBrowserProfile({ id: "rhea", controls: objectControls,
  audit: {
    canonicalPreparedAssets: ["/scenes/rhea/rhea-normal-surface@2x.webp", "/scenes/rhea/rhea-lighting.webp", "/scenes/rhea/rhea-directional-sun@2x.webp"],
    lensRace: { defaultId: "normal", slowId: "enhanced", winnerId: "normal",
      slowAsset: "/scenes/rhea/rhea-enhanced-surface@2x.webp", preReadyDisabled: true },
    retained: { lensIds: browserProfileLensIds(objectControls), allowedMountSelectors: [] },
  },
});
