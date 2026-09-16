import { createObjectBrowserProfile } from "../../../../site/test/object-browser-profile.mts";
import { readPreparedFixture } from "../../fixtures.mts";
const objectControls = await readPreparedFixture("makemake", "controls");

export const browserProfile = createObjectBrowserProfile({
  id: "makemake", controls: objectControls,
  audit: Object.freeze({
    preparedAssetPairs: Object.freeze([
      Object.freeze({ one: "/scenes/makemake/makemake-shape.webp", two: "/scenes/makemake/makemake-shape@2x.webp" }),
      Object.freeze({ one: "/scenes/makemake/makemake-poles-shape.webp", two: "/scenes/makemake/makemake-poles-shape@2x.webp" }),
      ]),
    retained: Object.freeze({
      lensIds: Object.freeze(["shape"]),
      allowedMountSelectors: Object.freeze([]),
    }),
  }),
});
