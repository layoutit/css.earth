import { createObjectBrowserProfile } from "../../../../site/test/object-browser-profile.mts";
import { readPreparedFixture } from "../../fixtures.mts";
const objectControls = await readPreparedFixture("makemake", "controls");

export const browserProfile = createObjectBrowserProfile({
  id: "makemake", controls: objectControls,
  audit: Object.freeze({
    canonicalPreparedAssets: Object.freeze([
      "/scenes/makemake/makemake-illustration@2x.webp",
      "/scenes/makemake/makemake-poles-illustration@2x.webp",
      "/scenes/makemake/makemake-starfield-front@2x.webp",
      "/scenes/makemake/makemake-directional-sun@2x.webp",
    ]),
    retained: Object.freeze({
      lensIds: Object.freeze(["illustration"]),
      allowedMountSelectors: Object.freeze([]),
    }),
  }),
});
