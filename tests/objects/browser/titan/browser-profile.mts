import { createObjectBrowserProfile } from "../../../../site/test/object-browser-profile.mts";
import { readPreparedFixture } from "../../fixtures.mts";
const objectControls = await readPreparedFixture("titan", "controls");

export const browserProfile = createObjectBrowserProfile({
  id: "titan", controls: objectControls,
  audit: Object.freeze({
    preparedAssetPairs: Object.freeze([
      Object.freeze({ one: "/scenes/titan/titan-normal.webp", two: "/scenes/titan/titan-normal@2x.webp" }),
      Object.freeze({ one: "/scenes/titan/titan-poles-normal.webp", two: "/scenes/titan/titan-poles-normal@2x.webp" }),
      Object.freeze({ one: "/scenes/titan/titan-starfield-front.webp", two: "/scenes/titan/titan-starfield-front@2x.webp" }),
      Object.freeze({ one: "/scenes/titan/titan-directional-sun.webp", two: "/scenes/titan/titan-directional-sun@2x.webp" }),
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
