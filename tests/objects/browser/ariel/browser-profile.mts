import { createObjectBrowserProfile } from "../../../../site/test/object-browser-profile.mts";
import { readPreparedFixture } from "../../fixtures.mts";
const objectControls = await readPreparedFixture("ariel", "controls");

export const browserProfile = createObjectBrowserProfile({
  id: "ariel", controls: objectControls,
  audit: Object.freeze({
    preparedAssetPairs: Object.freeze([
      Object.freeze({ one: "/scenes/ariel/ariel-normal.webp", two: "/scenes/ariel/ariel-normal@2x.webp" }),
      Object.freeze({ one: "/scenes/ariel/ariel-poles-normal.webp", two: "/scenes/ariel/ariel-poles-normal@2x.webp" }),
      Object.freeze({ one: "/scenes/ariel/ariel-starfield-front.webp", two: "/scenes/ariel/ariel-starfield-front@2x.webp" }),
      Object.freeze({ one: "/scenes/ariel/ariel-directional-sun.webp", two: "/scenes/ariel/ariel-directional-sun@2x.webp" }),
    ]),
    lensRace: Object.freeze({
      defaultId: "normal",
      slowId: "elevation",
      winnerId: "normal",
      slowAsset: "/scenes/ariel/ariel-elevation@2x.webp",
      preReadyDisabled: true,
    }),
    retained: Object.freeze({
      lensIds: Object.freeze(["normal","elevation"]),
      allowedMountSelectors: Object.freeze([]),
    }),
  }),
});
