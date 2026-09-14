import { createObjectBrowserProfile } from "../../../../site/test/object-browser-profile.mts";
import { readPreparedFixture } from "../../fixtures.mts";
const objectControls = await readPreparedFixture("europa", "controls");

export const browserProfile = createObjectBrowserProfile({
  id: "europa", controls: objectControls,
  audit: Object.freeze({
    preparedAssetPairs: Object.freeze([
      Object.freeze({ one: "/scenes/europa/europa-normal.webp", two: "/scenes/europa/europa-normal@2x.webp" }),
      Object.freeze({ one: "/scenes/europa/europa-poles-normal.webp", two: "/scenes/europa/europa-poles-normal@2x.webp" }),
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
