import { PREPARED_EARTH_SCENE } from "../../unit/earth/prepared-fixture.mts";
import { createObjectBrowserProfile } from "../../../../site/test/object-browser-profile.mts";
import { objectControls } from "../../unit/earth/prepared-fixture.mts";

export const browserProfile = createObjectBrowserProfile({
  id: "earth", controls: objectControls,
  audit: Object.freeze({
    canonicalPreparedAssets: Object.freeze([
      ...PREPARED_EARTH_SCENE.body.assets.surface.urls,
      "/scenes/earth/earth-surface-poles.webp",
    ]),
    lensRace: Object.freeze({
      defaultId: "normal",
      slowId: "topography",
      winnerId: "night-lights",
      slowAsset: "/scenes/earth/earth-topography.webp",
      preReadyDisabled: true,
    }),
    retained: Object.freeze({
      lensIds: Object.freeze(["normal", "clouds", "topography", "night-lights", "enso", "cross-section", "mantle-tomography"]),
      speedClicks: 5,
      allowedMountSelectors: Object.freeze([]),
    }),
  }),
});
