import { createObjectBrowserProfile } from "../../../../site/test/object-browser-profile.mjs";
import { objectControls } from "../site/control-content.mjs";

export const browserProfile = createObjectBrowserProfile({
  id: "mercury", controls: objectControls,
  audit: Object.freeze({
    preparedAssetPairs: Object.freeze([
      Object.freeze({
        one: "/scenes/mercury/mercury-surface-normal.webp",
        two: "/scenes/mercury/mercury-surface-normal@2x.webp",
      }),
      Object.freeze({
        one: "/scenes/mercury/mercury-poles.webp",
        two: "/scenes/mercury/mercury-poles@2x.webp",
      }),
      Object.freeze({
        one: "/scenes/mercury/mercury-lighting-1x-row-28.webp",
        two: "/scenes/mercury/mercury-lighting-2x-row-28.webp",
      }),
      Object.freeze({
        one: "/scenes/mercury/mercury-starfield-front.webp",
        two: "/scenes/mercury/mercury-starfield-front@2x.webp",
      }),
      Object.freeze({
        one: "/scenes/mercury/mercury-directional-sun.webp",
        two: "/scenes/mercury/mercury-directional-sun@2x.webp",
      }),
    ]),
    lensRace: Object.freeze({
      defaultId: "normal",
      slowId: "enhanced",
      winnerId: "topography",
      slowAsset: "/scenes/mercury/mercury-surface-enhanced@2x.webp",
      preReadyDisabled: true,
    }),
    retained: Object.freeze({
      lensIds: Object.freeze([
        "normal",
        "enhanced",
        "topography",
        "interior",
      ]),
      speedClicks: 5,
      allowedMountSelectors: Object.freeze([]),
    }),
  }),
  visibleViews: [{ attribute: "data-view", value: "interior", lensId: "interior" }],
});
