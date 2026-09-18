import { createObjectBrowserProfile } from "../../../../site/test/object-browser-profile.mts";
import { readPreparedFixture } from "../../fixtures.mts";
const objectControls = await readPreparedFixture("umbriel", "controls");

export const browserProfile = createObjectBrowserProfile({
  id: "umbriel", controls: objectControls,
  audit: Object.freeze({
    canonicalPreparedAssets: Object.freeze([
      "/scenes/umbriel/umbriel-normal@2x.webp",
      "/scenes/umbriel/umbriel-poles-normal@2x.webp",
    ]),
    retained: Object.freeze({
      lensIds: Object.freeze(["normal"]),
      allowedMountSelectors: Object.freeze([]),
    }),
  }),
});
