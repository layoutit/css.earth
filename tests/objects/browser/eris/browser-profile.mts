import { createObjectBrowserProfile } from "../../../../site/test/object-browser-profile.mts";
import { readPreparedFixture } from "../../fixtures.mts";
const objectControls = await readPreparedFixture("eris", "controls");

export const browserProfile = createObjectBrowserProfile({
  id: "eris", controls: objectControls,
  audit: Object.freeze({
    canonicalPreparedAssets: Object.freeze([
      "/scenes/eris/eris-color@2x.webp",
      "/scenes/eris/eris-poles-color@2x.webp",
    ]),
    retained: Object.freeze({
      lensIds: Object.freeze(["color", "illustration"]),
      allowedMountSelectors: Object.freeze([]),
    }),
  }),
});
