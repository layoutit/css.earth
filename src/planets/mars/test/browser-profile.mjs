import { PREPARED_MARS_LIGHTING } from "../runtime/preparedLighting.mjs";
import { createObjectBrowserProfile } from "../../../../site/test/object-browser-profile.mjs";
import { objectControls } from "../site/control-content.mjs";

const materialOne = PREPARED_MARS_LIGHTING.banks["1"];
const materialTwo = PREPARED_MARS_LIGHTING.banks["2"];
const defaultMaterialOne = materialOne.rows[materialOne.transport.defaultRow];
const defaultMaterialTwo = materialTwo.rows[materialTwo.transport.defaultRow];

export const browserProfile = createObjectBrowserProfile({
  id: "mars", inputSelector: ".planet-stage", controls: objectControls,
  cameraFields: ["pitch", "controlPitch", "controlYaw", "zoom"],
  audit: Object.freeze({
    preparedAssetPairs: Object.freeze([
      Object.freeze({
        one: "/scenes/mars/mars-surface.webp",
        two: "/scenes/mars/mars-surface@2x.webp",
      }),
      Object.freeze({
        one: "/scenes/mars/mars-poles.webp",
        two: "/scenes/mars/mars-poles@2x.webp",
      }),
      Object.freeze({
        one: defaultMaterialOne.url,
        two: defaultMaterialTwo.url,
      }),
      Object.freeze({
        one: "/scenes/mars/mars-starfield-front.webp",
        two: "/scenes/mars/mars-starfield-front@2x.webp",
      }),
      Object.freeze({
        one: "/scenes/mars/mars-directional-sun.webp",
        two: "/scenes/mars/mars-directional-sun@2x.webp",
      }),
    ]),
    lensRace: Object.freeze({
      defaultId: "normal",
      slowId: "elevation",
      winnerId: "thermal",
      slowAsset: "/scenes/mars/mars-lens-elevation@2x.webp",
      preReadyDisabled: false,
    }),
    retained: Object.freeze({
      lensIds: Object.freeze(["normal", "elevation", "thermal"]),
      speedClicks: 5,
      allowedMountSelectors: Object.freeze([]),
    }),
  }),
});
