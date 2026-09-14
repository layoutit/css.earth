import { createObjectBrowserProfile } from "../../../../site/test/object-browser-profile.mts";
import { readPreparedFixture } from "../../fixtures.mts";
const objectControls = await readPreparedFixture("miranda", "controls");

export const browserProfile = createObjectBrowserProfile({
  id: "miranda", controls: objectControls,
  audit: Object.freeze({
    preparedAssetPairs: Object.freeze([
      Object.freeze({ one: "/scenes/miranda/miranda-normal.webp", two: "/scenes/miranda/miranda-normal@2x.webp" }),
      Object.freeze({ one: "/scenes/miranda/miranda-poles-normal.webp", two: "/scenes/miranda/miranda-poles-normal@2x.webp" }),
      Object.freeze({ one: "/scenes/miranda/miranda-starfield-front.webp", two: "/scenes/miranda/miranda-starfield-front@2x.webp" }),
      ]),
    lensRace: Object.freeze({
      defaultId: "normal",
      slowId: "elevation",
      winnerId: "geology",
      slowAsset: "/scenes/miranda/miranda-elevation@2x.webp",
      preReadyDisabled: true,
    }),
    retained: Object.freeze({
      lensIds: Object.freeze(["normal","elevation","geology"]),
      allowedMountSelectors: Object.freeze([]),
    }),
  }),
});
