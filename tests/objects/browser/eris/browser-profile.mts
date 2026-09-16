import { createObjectBrowserProfile } from "../../../../site/test/object-browser-profile.mts";
import { readPreparedFixture } from "../../fixtures.mts";
const objectControls = await readPreparedFixture("eris", "controls");

export const browserProfile = createObjectBrowserProfile({
  id: "eris", controls: objectControls,
  audit: Object.freeze({
    preparedAssetPairs: Object.freeze([
      Object.freeze({ one: "/scenes/eris/eris-color.webp", two: "/scenes/eris/eris-color@2x.webp" }),
      Object.freeze({ one: "/scenes/eris/eris-poles-color.webp", two: "/scenes/eris/eris-poles-color@2x.webp" }),
      ]),
    retained: Object.freeze({
      lensIds: Object.freeze(["color"]),
      allowedMountSelectors: Object.freeze([]),
    }),
  }),
});
