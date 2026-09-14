// DRAFT (sun-port): replaces tests/objects/browser/sun/browser-profile.mts. The asset names are unchanged because the
// generic raster recipe reproduces them (sun-surface-{id}, sun-poles-{id}, sun-corona-{id}, sun-limb-{id},
// sun-lens-{id}); only the polar atlas layout differs.
import { readPreparedFixture } from '../../fixtures.mts';
const objectControls = await readPreparedFixture('sun', 'controls');
import { createObjectBrowserProfile } from "../../../../site/test/object-browser-profile.mts";

export const browserProfile = createObjectBrowserProfile({
  id: "sun", controls: objectControls,
  audit: Object.freeze({
    preparedAssetPairs: Object.freeze([
      Object.freeze({
        one: "/scenes/sun/sun-corona-photosphere.webp",
        two: "/scenes/sun/sun-corona-photosphere@2x.webp",
      }),
      Object.freeze({
        one: "/scenes/sun/sun-surface-photosphere.webp",
        two: "/scenes/sun/sun-surface-photosphere@2x.webp",
      }),
      Object.freeze({
        one: "/scenes/sun/sun-poles-photosphere.webp",
        two: "/scenes/sun/sun-poles-photosphere@2x.webp",
      }),
      Object.freeze({
        one: "/scenes/sun/sun-limb-photosphere.webp",
        two: "/scenes/sun/sun-limb-photosphere@2x.webp",
      }),
    ]),
    lensRace: Object.freeze({
      defaultId: "photosphere",
      slowId: "chromosphere",
      winnerId: "corona",
      slowAsset: "/scenes/sun/sun-surface-chromosphere@2x.webp",
      preReadyDisabled: true,
    }),
    retained: Object.freeze({
      lensIds: Object.freeze(["photosphere", "magnetic", "chromosphere", "corona"]),
      speedClicks: 5,
      allowedMountSelectors: Object.freeze([]),
    }),
  }),
});
