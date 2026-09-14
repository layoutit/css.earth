import { createObjectBrowserProfile } from "../../../../site/test/object-browser-profile.mts";
import { readPreparedFixture } from "../../fixtures.mts";
const objectControls = await readPreparedFixture("io", "controls");

export const browserProfile = createObjectBrowserProfile({
  id: "io", controls: objectControls,
  audit: Object.freeze({
    preparedAssetPairs: Object.freeze([
      Object.freeze({ one: "/scenes/io/io-normal.webp", two: "/scenes/io/io-normal@2x.webp" }),
      Object.freeze({ one: "/scenes/io/io-poles-normal.webp", two: "/scenes/io/io-poles-normal@2x.webp" }),
      Object.freeze({ one: "/scenes/io/io-starfield-front.webp", two: "/scenes/io/io-starfield-front@2x.webp" }),
      ]),
    lensRace: Object.freeze({
      defaultId: "normal",
      slowId: "enhanced",
      winnerId: "geology",
      slowAsset: "/scenes/io/io-enhanced@2x.webp",
      preReadyDisabled: true,
    }),
    retained: Object.freeze({
      lensIds: Object.freeze(["normal","enhanced","geology","spectral-slope","visible-absorption"]),
      allowedMountSelectors: Object.freeze([]),
    }),
  }),
});
