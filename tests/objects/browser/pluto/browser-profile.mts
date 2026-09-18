import { createObjectBrowserProfile } from "../../../../site/test/object-browser-profile.mts";
import { readPreparedFixture } from "../../fixtures.mts";
const objectControls = await readPreparedFixture("pluto", "controls");

export const browserProfile = createObjectBrowserProfile({
  id: "pluto", controls: objectControls,
  audit: Object.freeze({
    canonicalPreparedAssets: Object.freeze([
      "/scenes/pluto/pluto-surface@2x.webp",
      "/scenes/pluto/pluto-poles-surface@2x.webp",
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
