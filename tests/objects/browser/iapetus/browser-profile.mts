import { createObjectBrowserProfile } from "../../../../site/test/object-browser-profile.mts";
import { readPreparedFixture } from "../../fixtures.mts";
const objectControls = await readPreparedFixture("iapetus", "controls");

export const browserProfile = createObjectBrowserProfile({
  id: "iapetus", controls: objectControls,
  audit: Object.freeze({
    preparedAssetPairs: Object.freeze([
      Object.freeze({ one: "/scenes/iapetus/iapetus-normal.webp", two: "/scenes/iapetus/iapetus-normal@2x.webp" }),
      Object.freeze({ one: "/scenes/iapetus/iapetus-poles-normal.webp", two: "/scenes/iapetus/iapetus-poles-normal@2x.webp" }),
      Object.freeze({ one: "/scenes/iapetus/iapetus-starfield-front.webp", two: "/scenes/iapetus/iapetus-starfield-front@2x.webp" }),
      Object.freeze({ one: "/scenes/iapetus/iapetus-directional-sun.webp", two: "/scenes/iapetus/iapetus-directional-sun@2x.webp" }),
    ]),
    lensRace: Object.freeze({
      defaultId: "normal",
      slowId: "enhanced",
      winnerId: "infrared",
      slowAsset: "/scenes/iapetus/iapetus-enhanced@2x.webp",
      preReadyDisabled: true,
    }),
    retained: Object.freeze({
      lensIds: Object.freeze(["normal","enhanced","infrared","ice-absorption"]),
      allowedMountSelectors: Object.freeze([]),
    }),
  }),
});
