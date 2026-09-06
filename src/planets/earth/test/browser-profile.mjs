import { PREPARED_EARTH_SCENE } from "../runtime/preparedScene.mjs";
import { createObjectBrowserProfile } from "../../../../site/test/object-browser-profile.mjs";
import { objectControls } from "../site/control-content.mjs";

export const browserProfile = createObjectBrowserProfile({
  id: "earth", inputSelector: ".earth-input-surface", controls: objectControls,
  audit: Object.freeze({
    canonicalPreparedAssets: Object.freeze([
      ...PREPARED_EARTH_SCENE.body.assets.surface.urls,
      "/scenes/earth/earth-surface-poles.webp",
    ]),
    preparedAssetPairs: Object.freeze([
      Object.freeze({ one: "/scenes/earth/earth-starfield-front.webp", two: "/scenes/earth/earth-starfield-front@2x.webp" }),
      Object.freeze({ one: "/scenes/earth/earth-directional-sun.webp", two: "/scenes/earth/earth-directional-sun@2x.webp" }),
    ]),
    lensRace: Object.freeze({
      defaultId: "normal",
      slowId: "topography",
      winnerId: "night-lights",
      slowAsset: "/scenes/earth/earth-topography.webp",
      preReadyDisabled: true,
    }),
    retained: Object.freeze({
      lensIds: Object.freeze(["normal", "topography", "night-lights", "cross-section"]),
      speedClicks: 5,
      allowedMountSelectors: Object.freeze([]),
    }),
  }),
  visibleViews: [{ attribute: "data-view", value: "interior", lensId: "cross-section" }],
});
