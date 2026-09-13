import { createObjectBrowserProfile } from "../../../../site/test/object-browser-profile.mts";
import { readPreparedFixture } from "../../fixtures.mts";
const objectControls = await readPreparedFixture("eris", "controls");

export const browserProfile = createObjectBrowserProfile({
  id: "eris", controls: objectControls,
  audit: Object.freeze({
    canonicalPreparedAssets: Object.freeze([
      "/scenes/eris/eris-illustration@2x.webp",
      "/scenes/eris/eris-poles-illustration@2x.webp",
      "/scenes/eris/eris-starfield-front@2x.webp",
      "/scenes/eris/eris-directional-sun@2x.webp",
    ]),
    retained: Object.freeze({
      lensIds: Object.freeze(["illustration"]),
      allowedMountSelectors: Object.freeze([]),
    }),
  }),
});
