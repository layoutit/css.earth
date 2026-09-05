import { createObjectBrowserProfile } from "../../../../site/test/object-browser-profile.mjs";
import { objectControls } from "../site/control-content.mjs";

export const browserProfile = createObjectBrowserProfile({
  id: "uranus", inputSelector: ".uranus-input-surface", controls: objectControls,
  audit: Object.freeze({
    finalScope: "outer",
    fullComparisonWidths: Object.freeze([390, 820, 1200]),
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
      Object.freeze({
        one: "/scenes/uranus/uranus-starfield-front.webp",
        two: "/scenes/uranus/uranus-starfield-front@2x.webp",
      }),
      Object.freeze({
        one: "/scenes/uranus/uranus-directional-sun.webp",
        two: "/scenes/uranus/uranus-directional-sun@2x.webp",
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
