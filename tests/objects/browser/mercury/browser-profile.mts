import { createObjectBrowserProfile } from "../../../../site/test/object-browser-profile.mts";
import { readPreparedFixture } from "../../fixtures.mts";
const objectControls = await readPreparedFixture("mercury", "controls");

export const browserProfile = createObjectBrowserProfile({
  id: "mercury", controls: objectControls,
  audit: Object.freeze({
    // One prepared density: every surface, pole and lighting image is the canonical @2x file.
    canonicalPreparedAssets: Object.freeze([
      "/scenes/mercury/mercury-surface-normal@2x.jpg",
      "/scenes/mercury/mercury-poles@2x.webp",
      "/scenes/mercury/mercury-lighting-2x-row-28.webp",
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
