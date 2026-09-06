import { createObjectBrowserProfile } from "../../../../site/test/object-browser-profile.mjs";
import { objectControls } from "../site/control-content.mjs";

export const browserProfile = createObjectBrowserProfile({
  id: "saturn", inputSelector: ".saturn-input-surface", controls: objectControls,
  audit: Object.freeze({
    preparedAssetPairs: Object.freeze([
      Object.freeze({
        one: "/scenes/saturn/saturn-rings.webp",
        two: "/scenes/saturn/saturn-rings@2x.webp",
      }),
      Object.freeze({
        one: "/scenes/saturn/saturn-starfield-front.webp",
        two: "/scenes/saturn/saturn-starfield-front@2x.webp",
      }),
      Object.freeze({
        one: "/scenes/saturn/saturn-directional-sun.webp",
        two: "/scenes/saturn/saturn-directional-sun@2x.webp",
      }),
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
