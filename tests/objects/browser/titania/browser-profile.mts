import { createObjectBrowserProfile } from "../../../../site/test/object-browser-profile.mts";
import { readPreparedFixture } from "../../fixtures.mts";
const objectControls = await readPreparedFixture("titania", "controls");

export const browserProfile = createObjectBrowserProfile({
  id: "titania", controls: objectControls,
  audit: Object.freeze({
    preparedAssetPairs: Object.freeze([
      Object.freeze({ one: "/scenes/titania/titania-normal.webp", two: "/scenes/titania/titania-normal@2x.webp" }),
      Object.freeze({ one: "/scenes/titania/titania-poles-normal.webp", two: "/scenes/titania/titania-poles-normal@2x.webp" }),
      ]),
    lensRace: Object.freeze({
      defaultId: "normal",
      slowId: "elevation",
      winnerId: "geology",
      slowAsset: "/scenes/titania/titania-elevation@2x.webp",
      preReadyDisabled: true,
    }),
    retained: Object.freeze({
      lensIds: Object.freeze(["normal","elevation","geology"]),
      allowedMountSelectors: Object.freeze([]),
    }),
  }),
});
