import { createObjectBrowserProfile } from "../../../../site/test/object-browser-profile.mts";
import { readPreparedFixture } from "../../fixtures.mts";
const objectControls = await readPreparedFixture("io", "controls");

export const browserProfile = createObjectBrowserProfile({
  id: "io", controls: objectControls,
  audit: Object.freeze({
    canonicalPreparedAssets: Object.freeze([
      "/scenes/io/io-normal@2x.webp",
      "/scenes/io/io-poles-normal@2x.webp",
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
