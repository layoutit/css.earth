import { createObjectBrowserProfile } from "../../../../site/test/object-browser-profile.mts";
import { readPreparedFixture } from "../../fixtures.mts";
const objectControls = await readPreparedFixture("mars", "controls");

export const browserProfile = createObjectBrowserProfile({
  id: "mars", controls: objectControls, cameraFields: ["pitch", "controlPitch", "controlYaw", "zoom"],
  audit: Object.freeze({
    preparedAssetPairs: Object.freeze([
      Object.freeze({
        one: "/scenes/mars/mars-surface-normal.webp",
        two: "/scenes/mars/mars-surface-normal@2x.webp",
      }),
      Object.freeze({
        one: "/scenes/mars/mars-poles-normal.webp",
        two: "/scenes/mars/mars-poles-normal@2x.webp",
      }),
      Object.freeze({
        one: "/scenes/mars/mars-material.webp",
        two: "/scenes/mars/mars-material@2x.webp",
      }),
      Object.freeze({
        one: "/scenes/mars/mars-lighting.webp",
        two: "/scenes/mars/mars-lighting@2x.webp",
      }),
      ]),
    lensRace: Object.freeze({
      defaultId: "normal",
      slowId: "elevation",
      winnerId: "thermal",
      slowAsset: "/scenes/mars/mars-surface-elevation@2x.webp",
      preReadyDisabled: true,
    }),
    retained: Object.freeze({
      lensIds: Object.freeze(["normal", "elevation", "thermal"]),
      speedClicks: 5,
      allowedMountSelectors: Object.freeze([]),
    }),
  }),
});
