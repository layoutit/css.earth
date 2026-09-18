import { createObjectBrowserProfile } from "../../../../site/test/object-browser-profile.mts";
import { readPreparedFixture } from "../../fixtures.mts";
const objectControls = await readPreparedFixture("iapetus", "controls");

export const browserProfile = createObjectBrowserProfile({
  id: "iapetus", controls: objectControls,
  audit: Object.freeze({
    canonicalPreparedAssets: Object.freeze([
      "/scenes/iapetus/iapetus-normal@2x.webp",
      "/scenes/iapetus/iapetus-poles-normal@2x.webp",
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
