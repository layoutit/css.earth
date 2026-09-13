import { createObjectBrowserProfile } from "../../../../site/test/object-browser-profile.mts";
import { readPreparedFixture } from "../../fixtures.mts";
const objectControls = await readPreparedFixture("mercury", "controls");

export const browserProfile = createObjectBrowserProfile({
  id: "mercury", controls: objectControls,
  audit: Object.freeze({
    // The surface maps are prepared silhouette levels, not a density pair:
    // mount uses the 1x level and refines to @2x by projected size.
    canonicalPreparedAssets: Object.freeze([
      "/scenes/mercury/mercury-poles@2x.webp",
      "/scenes/mercury/mercury-lighting-2x-row-28.webp",
      "/scenes/mercury/mercury-starfield-front@2x.webp",
      "/scenes/mercury/mercury-directional-sun@2x.webp",
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
