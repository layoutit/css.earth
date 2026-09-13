import { browserProfileLensIds, createObjectBrowserProfile } from '../../../../site/test/object-browser-profile.mts';
import objectControls from '../../../../src/objects/deimos/prepared/controls.json' with { type: 'json' };

export const browserProfile = createObjectBrowserProfile({ id: 'deimos', controls: objectControls,
  audit: {
    preparedAssetPairs: [{ one: '/scenes/deimos/deimos-directional-sun.webp', two: '/scenes/deimos/deimos-directional-sun@2x.webp' }],
    canonicalPreparedAssets: ['/scenes/deimos/deimos-normal-surface@2x.webp', '/scenes/deimos/deimos-lighting.webp'],
    lensRace: { defaultId: 'normal', slowId: 'elevation', winnerId: 'normal',
      slowAsset: '/scenes/deimos/deimos-elevation-surface@2x.webp', preReadyDisabled: true },
    retained: { lensIds: browserProfileLensIds(objectControls), speedClicks: 5, allowedMountSelectors: [] },
  },
});
