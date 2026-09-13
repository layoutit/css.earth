import { createObjectBrowserProfile } from "../../../../site/test/object-browser-profile.mts";
import { readPreparedFixture } from "../../fixtures.mts";
const objectControls = await readPreparedFixture("pluto", "controls");

export const browserProfile = createObjectBrowserProfile({
  id: "pluto", controls: objectControls,
  audit: Object.freeze({
    canonicalPreparedAssets: Object.freeze([
      "/scenes/pluto/pluto-surface@2x.webp",
      "/scenes/pluto/pluto-poles-surface@2x.webp",
      "/scenes/pluto/pluto-starfield-front@2x.webp",
      "/scenes/pluto/pluto-directional-sun@2x.webp",
    ]),
    lensRace: Object.freeze({
      defaultId: "surface",
      slowId: "topography",
      winnerId: "monochrome",
      slowAsset: "/scenes/pluto/pluto-topography@2x.webp",
      preReadyDisabled: true,
    }),
    retained: Object.freeze({
      lensIds: Object.freeze(["surface", "topography", "monochrome"]),
      speedClicks: 5,
      allowedMountSelectors: Object.freeze([]),
    }),
  }),
});
