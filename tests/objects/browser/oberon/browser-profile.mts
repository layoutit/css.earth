import { createObjectBrowserProfile } from "../../../../site/test/object-browser-profile.mts";
import { readPreparedFixture } from "../../fixtures.mts";
const objectControls = await readPreparedFixture("oberon", "controls");

export const browserProfile = createObjectBrowserProfile({
  id: "oberon", controls: objectControls,
  audit: Object.freeze({
    preparedAssetPairs: Object.freeze([
      Object.freeze({ one: "/scenes/oberon/oberon-normal.webp", two: "/scenes/oberon/oberon-normal@2x.webp" }),
      Object.freeze({ one: "/scenes/oberon/oberon-poles-normal.webp", two: "/scenes/oberon/oberon-poles-normal@2x.webp" }),
      ]),
    retained: Object.freeze({
      lensIds: Object.freeze(["normal"]),
      allowedMountSelectors: Object.freeze([]),
    }),
  }),
});
