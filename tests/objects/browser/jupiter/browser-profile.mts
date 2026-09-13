import { createObjectBrowserProfile } from "../../../../site/test/object-browser-profile.mts";
import objectControls from "../../../../src/objects/jupiter/prepared/controls.json" with { type: "json" };

export const browserProfile = createObjectBrowserProfile({
  id: "jupiter", controls: objectControls,
  cameraFields: ["pitch", "controlPitch", "controlYaw", "zoom"],
  audit: Object.freeze({
    preparedAssetPairs: Object.freeze([
      Object.freeze({
        one: "/scenes/jupiter/jupiter-surface.webp",
        two: "/scenes/jupiter/jupiter-surface@2x.webp",
      }),
      Object.freeze({
        one: "/scenes/jupiter/jupiter-poles.webp",
        two: "/scenes/jupiter/jupiter-poles@2x.webp",
      }),
      Object.freeze({
        one: "/scenes/jupiter/jupiter-rings.webp",
        two: "/scenes/jupiter/jupiter-rings@2x.webp",
      }),
      Object.freeze({
        one: "/scenes/jupiter/jupiter-starfield-front.webp",
        two: "/scenes/jupiter/jupiter-starfield-front@2x.webp",
      }),
      Object.freeze({
        one: "/scenes/jupiter/jupiter-directional-sun.webp",
        two: "/scenes/jupiter/jupiter-directional-sun@2x.webp",
      }),
    ]),
    lensRace: Object.freeze({
      defaultId: "normal",
      slowId: "ultraviolet",
      winnerId: "methane",
      slowAsset: "/scenes/jupiter/jupiter-lens-ultraviolet@2x.webp",
      preReadyDisabled: false,
    }),
    retained: Object.freeze({
      lensIds: Object.freeze(["normal", "ultraviolet", "methane"]),
      speedClicks: 5,
      allowedMountSelectors: Object.freeze([]),
    }),
  }),
});
