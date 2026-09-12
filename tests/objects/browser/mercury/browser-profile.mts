import { createObjectBrowserProfile } from "../../../../site/test/object-browser-profile.mts";
import { readPreparedFixture } from "../../fixtures.mts";
const objectControls = await readPreparedFixture("mercury", "controls");

export const browserProfile = createObjectBrowserProfile({
  id: "mercury", controls: objectControls,
  audit: Object.freeze({
    // The surface maps are prepared silhouette levels, not a density pair:
    // mount uses the 1x level and refines to @2x by projected size.
    preparedAssetPairs: Object.freeze([
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
      slowAsset: "/scenes/mercury/mercury-surface-enhanced@2x.jpg",
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
