import { createObjectBrowserProfile } from "../../../../site/test/object-browser-profile.mts";
import { readPreparedFixture } from "../../fixtures.mts";
const objectControls = await readPreparedFixture("eris", "controls");

export const browserProfile = createObjectBrowserProfile({
  id: "eris", controls: objectControls,
  audit: Object.freeze({
    preparedAssetPairs: Object.freeze([
      Object.freeze({ one: "/scenes/eris/eris-shape.webp", two: "/scenes/eris/eris-shape@2x.webp" }),
      Object.freeze({ one: "/scenes/eris/eris-poles-shape.webp", two: "/scenes/eris/eris-poles-shape@2x.webp" }),
      ]),
    retained: Object.freeze({
      lensIds: Object.freeze(["shape"]),
      allowedMountSelectors: Object.freeze([]),
    }),
  }),
});
