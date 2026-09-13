import { createObjectBrowserProfile } from "../../../../site/test/object-browser-profile.mts";
import { readPreparedFixture } from "../../fixtures.mts";
const objectControls = await readPreparedFixture("europa", "controls");

export const browserProfile = createObjectBrowserProfile({
  id: "europa", controls: objectControls,
  audit: Object.freeze({
    canonicalPreparedAssets: Object.freeze([
      "/scenes/europa/europa-normal@2x.webp",
      "/scenes/europa/europa-poles-normal@2x.webp",
      "/scenes/europa/europa-starfield-front@2x.webp",
      "/scenes/europa/europa-directional-sun@2x.webp",
    ]),
    lensRace: Object.freeze({
      defaultId: "normal",
      slowId: "enhanced",
      winnerId: "elevation",
      slowAsset: "/scenes/europa/europa-enhanced@2x.webp",
      preReadyDisabled: true,
    }),
    retained: Object.freeze({
      lensIds: Object.freeze(["normal","enhanced","elevation","geology","infrared"]),
      allowedMountSelectors: Object.freeze([]),
    }),
  }),
});
