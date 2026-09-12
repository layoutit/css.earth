import { createObjectBrowserProfile } from "../../../../site/test/object-browser-profile.mts";
import { readPreparedFixture } from "../../fixtures.mts";
const objectControls = await readPreparedFixture("callisto", "controls");

export const browserProfile = createObjectBrowserProfile({
  id: "callisto", controls: objectControls,
  audit: Object.freeze({
    preparedAssetPairs: Object.freeze([
      Object.freeze({ one: "/scenes/callisto/callisto-normal.webp", two: "/scenes/callisto/callisto-normal@2x.webp" }),
      Object.freeze({ one: "/scenes/callisto/callisto-poles-normal.webp", two: "/scenes/callisto/callisto-poles-normal@2x.webp" }),
      Object.freeze({ one: "/scenes/callisto/callisto-starfield-front.webp", two: "/scenes/callisto/callisto-starfield-front@2x.webp" }),
      Object.freeze({ one: "/scenes/callisto/callisto-directional-sun.webp", two: "/scenes/callisto/callisto-directional-sun@2x.webp" }),
    ]),
    lensRace: Object.freeze({
      defaultId: "normal",
      slowId: "enhanced",
      winnerId: "infrared",
      slowAsset: "/scenes/callisto/callisto-enhanced@2x.webp",
      preReadyDisabled: true,
    }),
    retained: Object.freeze({
      lensIds: Object.freeze(["normal","enhanced","infrared"]),
      allowedMountSelectors: Object.freeze([]),
    }),
  }),
});
