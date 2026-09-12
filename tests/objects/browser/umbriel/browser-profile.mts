import { createObjectBrowserProfile } from "../../../../site/test/object-browser-profile.mts";
import { readPreparedFixture } from "../../fixtures.mts";
const objectControls = await readPreparedFixture("umbriel", "controls");

export const browserProfile = createObjectBrowserProfile({
  id: "umbriel", controls: objectControls,
  audit: Object.freeze({
    preparedAssetPairs: Object.freeze([
      Object.freeze({ one: "/scenes/umbriel/umbriel-normal.webp", two: "/scenes/umbriel/umbriel-normal@2x.webp" }),
      Object.freeze({ one: "/scenes/umbriel/umbriel-poles-normal.webp", two: "/scenes/umbriel/umbriel-poles-normal@2x.webp" }),
      Object.freeze({ one: "/scenes/umbriel/umbriel-starfield-front.webp", two: "/scenes/umbriel/umbriel-starfield-front@2x.webp" }),
      Object.freeze({ one: "/scenes/umbriel/umbriel-directional-sun.webp", two: "/scenes/umbriel/umbriel-directional-sun@2x.webp" }),
    ]),
    retained: Object.freeze({
      lensIds: Object.freeze(["normal"]),
      allowedMountSelectors: Object.freeze([]),
    }),
  }),
});
