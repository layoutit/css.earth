import { createObjectBrowserProfile } from "../../../../site/test/object-browser-profile.mts";
import objectControls from "../../../../src/planets/jupiter/prepared/controls.json" with { type: "json" };

export const browserProfile = createObjectBrowserProfile({
  id: "jupiter", controls: objectControls,
  cameraFields: ["pitch", "controlPitch", "controlYaw", "zoom"],
  audit: Object.freeze({
    canonicalPreparedAssets: Object.freeze([
      "/scenes/jupiter/jupiter-surface@2x.webp",
      "/scenes/jupiter/jupiter-poles@2x.webp",
      "/scenes/jupiter/jupiter-rings@2x.webp",
      "/scenes/jupiter/jupiter-starfield-front@2x.webp",
      "/scenes/jupiter/jupiter-directional-sun@2x.webp",
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
