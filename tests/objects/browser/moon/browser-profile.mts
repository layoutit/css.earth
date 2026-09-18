import { createObjectBrowserProfile } from "../../../../site/test/object-browser-profile.mts";
import { readPreparedFixture } from "../../fixtures.mts";
const objectControls = await readPreparedFixture("moon", "controls");

export const browserProfile = createObjectBrowserProfile({
  id: "moon", controls: objectControls,
  audit: Object.freeze({
    canonicalPreparedAssets: Object.freeze([
      "/scenes/moon/moon-surface@2x.webp",
      "/scenes/moon/moon-poles-surface@2x.webp",
    ]),
    lensRace: Object.freeze({
      defaultId: "surface",
      slowId: "topography",
      winnerId: "crust",
      slowAsset: "/scenes/moon/moon-topography@2x.webp",
      preReadyDisabled: true,
    }),
    retained: Object.freeze({
      lensIds: Object.freeze(["surface", "midnight-temperature", "heat-anomalies", "rock-abundance", "topography", "crust", "silicate-signature", "geology"]),
      speedClicks: 5,
      allowedMountSelectors: Object.freeze([]),
    }),
  }),
});
