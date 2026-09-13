import { createObjectBrowserProfile } from "../../../../site/test/object-browser-profile.mts";
import { readPreparedFixture } from "../../fixtures.mts";
const objectControls = await readPreparedFixture("oberon", "controls");

export const browserProfile = createObjectBrowserProfile({
  id: "oberon", controls: objectControls,
  audit: Object.freeze({
    canonicalPreparedAssets: Object.freeze([
      "/scenes/oberon/oberon-normal@2x.webp",
      "/scenes/oberon/oberon-poles-normal@2x.webp",
      "/scenes/oberon/oberon-starfield-front@2x.webp",
      "/scenes/oberon/oberon-directional-sun@2x.webp",
    ]),
    retained: Object.freeze({
      lensIds: Object.freeze(["normal"]),
      allowedMountSelectors: Object.freeze([]),
    }),
  }),
});
