import { createObjectBrowserProfile } from "../../../../site/test/object-browser-profile.mts";
import objectControls from "../../../../src/planets/saturn/prepared/controls.json" with { type: "json" };

export const browserProfile = createObjectBrowserProfile({
  id: "saturn", controls: objectControls,
  audit: Object.freeze({
    canonicalPreparedAssets: Object.freeze([
      "/scenes/saturn/saturn-rings@2x.webp",
      "/scenes/saturn/saturn-starfield-front@2x.webp",
      "/scenes/saturn/saturn-directional-sun@2x.webp",
    ]),
    lensRace: Object.freeze({
      defaultId: "normal",
      slowId: "ultraviolet",
      winnerId: "methane",
      slowAsset: "/scenes/saturn/saturn-surface-ultraviolet@2x.webp",
      preReadyDisabled: true,
    }),
    retained: Object.freeze({
      lensIds: Object.freeze([
        "normal",
        "ultraviolet",
        "methane",
        "thermal",
        "cross-section",
      ]),
      speedClicks: 5,
      allowedMountSelectors: Object.freeze([]),
    }),
  }),
  visibleViews: [{ attribute: "data-view", value: "interior", lensId: "cross-section" }],
});
