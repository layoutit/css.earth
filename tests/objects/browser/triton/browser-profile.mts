import { createObjectBrowserProfile } from "../../../../site/test/object-browser-profile.mts";
import { readPreparedFixture } from "../../fixtures.mts";
const objectControls = await readPreparedFixture("triton", "controls");

export const browserProfile = createObjectBrowserProfile({
  id: "triton", controls: objectControls,
  audit: Object.freeze({
    preparedAssetPairs: Object.freeze([
      Object.freeze({ one: "/scenes/triton/triton-normal.webp", two: "/scenes/triton/triton-normal@2x.webp" }),
      Object.freeze({ one: "/scenes/triton/triton-poles-normal.webp", two: "/scenes/triton/triton-poles-normal@2x.webp" }),
      ]),
    lensRace: Object.freeze({
      defaultId: "normal",
      slowId: "enhanced",
      winnerId: "normal",
      slowAsset: "/scenes/triton/triton-enhanced@2x.webp",
      preReadyDisabled: true,
    }),
    retained: Object.freeze({
      lensIds: Object.freeze(["normal","enhanced"]),
      allowedMountSelectors: Object.freeze([]),
    }),
  }),
});
