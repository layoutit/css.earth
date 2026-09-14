import { createObjectBrowserProfile } from "../../../../site/test/object-browser-profile.mts";
import objectControls from "../../../../src/objects/neptune/prepared/controls.json" with { type: "json" };

export const browserProfile = createObjectBrowserProfile({
  id: "neptune", controls: objectControls,
  audit: Object.freeze({
    preparedAssetPairs: Object.freeze([
      Object.freeze({
        one: "/scenes/neptune/neptune-rings.webp",
        two: "/scenes/neptune/neptune-rings@2x.webp",
      }),
      Object.freeze({
        one: "/scenes/neptune/neptune-surface-normal.webp",
        two: "/scenes/neptune/neptune-surface-normal@2x.webp",
      }),
      ]),
    lensRace: Object.freeze({
      defaultId: "normal",
      slowId: "methane",
      winnerId: "near-infrared",
      slowAsset: "/scenes/neptune/neptune-surface-methane@2x.webp",
      preReadyDisabled: true,
    }),
    retained: Object.freeze({
      lensIds: Object.freeze(["normal", "methane", "near-infrared"]),
      speedClicks: 5,
      allowedMountSelectors: Object.freeze([]),
    }),
  }),
});
