import { createObjectBrowserProfile } from "../../../../site/test/object-browser-profile.mts";
import { readPreparedFixture } from "../../fixtures.mts";
const objectControls = await readPreparedFixture("triton", "controls");

export const browserProfile = createObjectBrowserProfile({
  id: "triton", controls: objectControls,
  audit: Object.freeze({
    canonicalPreparedAssets: Object.freeze([
      "/scenes/triton/triton-normal@2x.webp",
      "/scenes/triton/triton-poles-normal@2x.webp",
      "/scenes/triton/triton-starfield-front@2x.webp",
      "/scenes/triton/triton-directional-sun@2x.webp",
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
