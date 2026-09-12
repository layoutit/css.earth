import { createObjectBrowserProfile } from "../../../../site/test/object-browser-profile.mts";
import { readPreparedFixture } from "../../fixtures.mts";
const objectControls = await readPreparedFixture("pluto", "controls");

export const browserProfile = createObjectBrowserProfile({
  id: "pluto", controls: objectControls,
  audit: Object.freeze({
    preparedAssetPairs: Object.freeze([
      Object.freeze({
        one: "/scenes/pluto/pluto-surface.webp",
        two: "/scenes/pluto/pluto-surface@2x.webp",
      }),
      Object.freeze({
        one: "/scenes/pluto/pluto-poles-surface.webp",
        two: "/scenes/pluto/pluto-poles-surface@2x.webp",
      }),
      Object.freeze({
        one: "/scenes/pluto/pluto-starfield-front.webp",
        two: "/scenes/pluto/pluto-starfield-front@2x.webp",
      }),
      Object.freeze({
        one: "/scenes/pluto/pluto-directional-sun.webp",
        two: "/scenes/pluto/pluto-directional-sun@2x.webp",
      }),
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
