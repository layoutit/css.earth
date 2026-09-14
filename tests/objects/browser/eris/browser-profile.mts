import { createObjectBrowserProfile } from "../../../../site/test/object-browser-profile.mts";
import { readPreparedFixture } from "../../fixtures.mts";
const objectControls = await readPreparedFixture("eris", "controls");

export const browserProfile = createObjectBrowserProfile({
  id: "eris", controls: objectControls,
  audit: Object.freeze({
    preparedAssetPairs: Object.freeze([
      Object.freeze({ one: "/scenes/eris/eris-illustration.webp", two: "/scenes/eris/eris-illustration@2x.webp" }),
      Object.freeze({ one: "/scenes/eris/eris-poles-illustration.webp", two: "/scenes/eris/eris-poles-illustration@2x.webp" }),
      ]),
    retained: Object.freeze({
      lensIds: Object.freeze(["illustration"]),
      allowedMountSelectors: Object.freeze([]),
    }),
  }),
});
