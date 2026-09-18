import { createObjectBrowserProfile } from "../../../../site/test/object-browser-profile.mts";
import { readPreparedFixture } from "../../fixtures.mts";
const objectControls = await readPreparedFixture("makemake", "controls");

export const browserProfile = createObjectBrowserProfile({
  id: "makemake", controls: objectControls,
  audit: Object.freeze({
    canonicalPreparedAssets: Object.freeze([
      "/scenes/makemake/makemake-color@2x.webp",
      "/scenes/makemake/makemake-poles-color@2x.webp",
    ]),
    retained: Object.freeze({
      lensIds: Object.freeze(["color", "illustration"]),
      allowedMountSelectors: Object.freeze([]),
    }),
  }),
});
