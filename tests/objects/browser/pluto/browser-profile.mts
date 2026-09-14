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
      ]),
    lensRace: Object.freeze({
      defaultId: "surface",
      slowId: "methane-ice",
      winnerId: "water-ice",
      slowAsset: "/scenes/pluto/pluto-methane-ice@2x.webp",
      preReadyDisabled: true,
    }),
    retained: Object.freeze({
      lensIds: Object.freeze(["surface", "topography", "monochrome", "methane-ice", "nitrogen-ice", "water-ice"]),
      speedClicks: 5,
      allowedMountSelectors: Object.freeze([]),
    }),
  }),
});
