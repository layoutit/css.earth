import { createObjectBrowserProfile } from "../../../../site/test/object-browser-profile.mts";
import { readPreparedFixture } from "../../fixtures.mts";
const objectControls = await readPreparedFixture("charon", "controls");

export const browserProfile = createObjectBrowserProfile({
  id: "charon", controls: objectControls,
  audit: Object.freeze({
    canonicalPreparedAssets: Object.freeze([
      "/scenes/charon/charon-normal@2x.webp",
      "/scenes/charon/charon-poles-normal@2x.webp",
      "/scenes/charon/charon-starfield-front@2x.webp",
      "/scenes/charon/charon-directional-sun@2x.webp",
    ]),
    lensRace: Object.freeze({
      defaultId: "normal",
      slowId: "enhanced-color",
      winnerId: "elevation",
      slowAsset: "/scenes/charon/charon-enhanced-color@2x.webp",
      preReadyDisabled: true,
    }),
    retained: Object.freeze({
      lensIds: Object.freeze(["normal","enhanced-color","elevation","albedo"]),
      allowedMountSelectors: Object.freeze([]),
    }),
  }),
});
