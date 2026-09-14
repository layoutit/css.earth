import { createObjectBrowserProfile } from "../../../../site/test/object-browser-profile.mts";
import objectControls from "../../../../src/objects/uranus/prepared/controls.json" with { type: "json" };

export const browserProfile = createObjectBrowserProfile({
  id: "uranus", controls: objectControls,
  audit: Object.freeze({
    preparedAssetPairs: Object.freeze([
      Object.freeze({
        one: "/scenes/uranus/uranus-surface-normal.webp",
        two: "/scenes/uranus/uranus-surface-normal@2x.webp",
      }),
      Object.freeze({
        one: "/scenes/uranus/uranus-fixed-material-normal.webp",
        two: "/scenes/uranus/uranus-fixed-material-normal@2x.webp",
      }),
      Object.freeze({
        one: "/scenes/uranus/uranus-rings.webp",
        two: "/scenes/uranus/uranus-rings@2x.webp",
      }),
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
