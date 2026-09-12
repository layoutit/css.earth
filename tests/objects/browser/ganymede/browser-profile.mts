import { createObjectBrowserProfile } from "../../../../site/test/object-browser-profile.mts";
import { readPreparedFixture } from "../../fixtures.mts";
const objectControls = await readPreparedFixture("ganymede", "controls");

export const browserProfile = createObjectBrowserProfile({
  id: "ganymede", controls: objectControls,
  audit: Object.freeze({
    preparedAssetPairs: Object.freeze([
      Object.freeze({ one: "/scenes/ganymede/ganymede-normal.webp", two: "/scenes/ganymede/ganymede-normal@2x.webp" }),
      Object.freeze({ one: "/scenes/ganymede/ganymede-poles-normal.webp", two: "/scenes/ganymede/ganymede-poles-normal@2x.webp" }),
      Object.freeze({ one: "/scenes/ganymede/ganymede-starfield-front.webp", two: "/scenes/ganymede/ganymede-starfield-front@2x.webp" }),
      Object.freeze({ one: "/scenes/ganymede/ganymede-directional-sun.webp", two: "/scenes/ganymede/ganymede-directional-sun@2x.webp" }),
    ]),
    lensRace: Object.freeze({
      defaultId: "normal",
      slowId: "enhanced",
      winnerId: "geology",
      slowAsset: "/scenes/ganymede/ganymede-enhanced@2x.webp",
      preReadyDisabled: true,
    }),
    retained: Object.freeze({
      lensIds: Object.freeze(["normal","enhanced","geology","oxygen-signature"]),
      allowedMountSelectors: Object.freeze([]),
    }),
  }),
});
