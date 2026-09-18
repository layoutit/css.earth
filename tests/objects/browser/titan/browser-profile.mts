import { createObjectBrowserProfile } from "../../../../site/test/object-browser-profile.mts";
import { readPreparedFixture } from "../../fixtures.mts";
const objectControls = await readPreparedFixture("titan", "controls");

export const browserProfile = createObjectBrowserProfile({
  id: "titan", controls: objectControls,
  audit: Object.freeze({
    canonicalPreparedAssets: Object.freeze([
      "/scenes/titan/titan-normal@2x.webp",
      "/scenes/titan/titan-poles-normal@2x.webp",
    ]),
    lensRace: Object.freeze({
      defaultId: "normal",
      slowId: "radar",
      winnerId: "topography",
      slowAsset: "/scenes/titan/titan-radar@2x.webp",
      preReadyDisabled: true,
    }),
    retained: Object.freeze({
      lensIds: Object.freeze(["normal","radar","topography","interpolated","coverage-distance","geology"]),
      allowedMountSelectors: Object.freeze([]),
    }),
  }),
});
