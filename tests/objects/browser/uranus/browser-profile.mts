import { createObjectBrowserProfile } from "../../../../site/test/object-browser-profile.mts";
import objectControls from "../../../../src/planets/uranus/prepared/controls.json" with { type: "json" };

export const browserProfile = createObjectBrowserProfile({
  id: "uranus", controls: objectControls,
  audit: Object.freeze({
    canonicalPreparedAssets: Object.freeze([
      "/scenes/uranus/uranus-surface-normal@2x.webp",
      "/scenes/uranus/uranus-fixed-material-normal@2x.webp",
      "/scenes/uranus/uranus-rings@2x.webp",
      "/scenes/uranus/uranus-starfield-front@2x.webp",
      "/scenes/uranus/uranus-directional-sun@2x.webp",
    ]),
    lensRace: Object.freeze({
      defaultId: "normal",
      slowId: "near-infrared",
      winnerId: "methane",
      slowAsset: "/scenes/uranus/uranus-surface-near-infrared@2x.webp",
      preReadyDisabled: true,
    }),
    retained: Object.freeze({
      lensIds: Object.freeze(["normal", "methane", "near-infrared"]),
      speedClicks: 5,
      allowedMountSelectors: Object.freeze([]),
    }),
  }),
});
