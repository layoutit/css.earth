import { createObjectBrowserProfile } from "../../../../site/test/object-browser-profile.mts";
import { readPreparedFixture } from "../../fixtures.mts";
const objectControls = await readPreparedFixture("ariel", "controls");

export const browserProfile = createObjectBrowserProfile({
  id: "ariel", controls: objectControls,
  audit: Object.freeze({
    canonicalPreparedAssets: Object.freeze([
      "/scenes/ariel/ariel-normal@2x.webp",
      "/scenes/ariel/ariel-poles-normal@2x.webp",
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
