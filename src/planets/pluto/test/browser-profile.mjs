import { createObjectBrowserProfile } from "../../../../site/test/object-browser-profile.mjs";
import { objectControls } from "../site/control-content.mjs";

export const browserProfile = createObjectBrowserProfile({
  id: "pluto", inputSelector: ".pluto-input-surface", controls: objectControls,
  audit: Object.freeze({
    finalScope: "outer",
    fullComparisonWidths: Object.freeze([390, 820, 1200]),
    preparedAssetPairs: Object.freeze([
      Object.freeze({
        one: "/scenes/pluto/pluto-surface.webp",
        two: "/scenes/pluto/pluto-surface@2x.webp",
      }),
      Object.freeze({
        one: "/scenes/pluto/pluto-surface-poles.webp",
        two: "/scenes/pluto/pluto-surface-poles@2x.webp",
      }),
      Object.freeze({
        one: "/scenes/pluto/pluto-curvature.webp",
        two: "/scenes/pluto/pluto-curvature@2x.webp",
      }),
      Object.freeze({
        one: "/scenes/pluto/pluto-starfield-front-standard.webp",
        two: "/scenes/pluto/pluto-starfield-front-standard@2x.webp",
      }),
      Object.freeze({
        one: "/scenes/pluto/pluto-directional-sun.webp",
        two: "/scenes/pluto/pluto-directional-sun@2x.webp",
      }),
    ]),
    lensRace: Object.freeze({
      defaultId: "surface",
      slowId: "topography",
      winnerId: "monochrome",
      slowAsset: "/scenes/pluto/pluto-topography@2x.webp",
      preReadyDisabled: true,
    }),
    retained: Object.freeze({
      lensIds: Object.freeze(["surface", "topography", "monochrome"]),
      speedClicks: 5,
      allowedMountSelectors: Object.freeze([]),
    }),
  }),
});
