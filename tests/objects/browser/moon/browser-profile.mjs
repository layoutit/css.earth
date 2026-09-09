import { readPreparedFixture } from '../../fixtures.mjs';
const objectControls = await readPreparedFixture('moon', 'controls');
import { createObjectBrowserProfile } from "../../../../site/test/object-browser-profile.mjs";


export const browserProfile = createObjectBrowserProfile({
  id: "moon", controls: objectControls,
  audit: Object.freeze({
    preparedAssetPairs: Object.freeze([
      Object.freeze({
        one: "/scenes/moon/moon-surface.webp",
        two: "/scenes/moon/moon-surface@2x.webp",
      }),
      Object.freeze({
        one: "/scenes/moon/moon-surface-poles.webp",
        two: "/scenes/moon/moon-surface-poles@2x.webp",
      }),
      Object.freeze({
        one: "/scenes/moon/moon-curvature.webp",
        two: "/scenes/moon/moon-curvature@2x.webp",
      }),
      Object.freeze({
        one: "/scenes/moon/moon-starfield-front-standard.webp",
        two: "/scenes/moon/moon-starfield-front-standard@2x.webp",
      }),
      Object.freeze({
        one: "/scenes/moon/moon-directional-sun.webp",
        two: "/scenes/moon/moon-directional-sun@2x.webp",
      }),
    ]),
    lensRace: Object.freeze({
      defaultId: "surface",
      slowId: "topography",
      winnerId: "crust",
      slowAsset: "/scenes/moon/moon-topography@2x.webp",
      preReadyDisabled: true,
    }),
    retained: Object.freeze({
      lensIds: Object.freeze(["surface", "topography", "crust", "rock-abundance"]),
      speedClicks: 5,
      allowedMountSelectors: Object.freeze([]),
    }),
  }),
});
