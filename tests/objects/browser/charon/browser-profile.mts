import { createObjectBrowserProfile } from "../../../../site/test/object-browser-profile.mts";
import { readPreparedFixture } from "../../fixtures.mts";
const objectControls = await readPreparedFixture("charon", "controls");

export const browserProfile = createObjectBrowserProfile({
  id: "charon", controls: objectControls,
  audit: Object.freeze({
    preparedAssetPairs: Object.freeze([
      Object.freeze({ one: "/scenes/charon/charon-normal.webp", two: "/scenes/charon/charon-normal@2x.webp" }),
      Object.freeze({ one: "/scenes/charon/charon-poles-normal.webp", two: "/scenes/charon/charon-poles-normal@2x.webp" }),
      Object.freeze({ one: "/scenes/charon/charon-starfield-front.webp", two: "/scenes/charon/charon-starfield-front@2x.webp" }),
      Object.freeze({ one: "/scenes/charon/charon-directional-sun.webp", two: "/scenes/charon/charon-directional-sun@2x.webp" }),
    ]),
    lensRace: Object.freeze({
      defaultId: "normal",
      slowId: "enhanced-color",
      winnerId: "elevation",
      slowAsset: "/scenes/charon/charon-enhanced-color@2x.webp",
      preReadyDisabled: true,
    }),
    retained: Object.freeze({
      lensIds: Object.freeze(["normal","enhanced-color","elevation","albedo","water-ice","ammonia"]),
      allowedMountSelectors: Object.freeze([]),
    }),
  }),
});
