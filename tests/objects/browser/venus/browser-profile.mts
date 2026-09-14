import { createObjectBrowserProfile } from "../../../../site/test/object-browser-profile.mts";
import { readPreparedFixture } from "../../fixtures.mts";
const objectControls = await readPreparedFixture("venus", "controls");

export const browserProfile = createObjectBrowserProfile({
  id: "venus", controls: objectControls,
  audit: Object.freeze({
    preparedAssetPairs: Object.freeze([
      Object.freeze({
        one: "/scenes/venus/venus-clouds.webp",
        two: "/scenes/venus/venus-clouds@2x.webp",
      }),
      Object.freeze({
        one: "/scenes/venus/venus-poles-clouds.webp",
        two: "/scenes/venus/venus-poles-clouds@2x.webp",
      }),
      Object.freeze({
        one: "/scenes/venus/venus-material.webp",
        two: "/scenes/venus/venus-material@2x.webp",
      }),
      Object.freeze({
        one: "/scenes/venus/venus-lighting.webp",
        two: "/scenes/venus/venus-lighting@2x.webp",
      }),
      Object.freeze({
        one: "/scenes/venus/venus-starfield-front.webp",
        two: "/scenes/venus/venus-starfield-front@2x.webp",
      }),
      ]),
    lensRace: Object.freeze({
      defaultId: "clouds",
      slowId: "radar",
      winnerId: "elevation",
      slowAsset: "/scenes/venus/venus-radar@2x.webp",
      preReadyDisabled: true,
    }),
    retained: Object.freeze({
      lensIds: Object.freeze(["clouds", "radar", "elevation"]),
      speedClicks: 5,
      allowedMountSelectors: Object.freeze([]),
    }),
  }),
});
