import { browserProfileLensIds, createObjectBrowserProfile } from '../../../../site/test/object-browser-profile.mts';
import objectControls from '../../../../src/planets/proteus/prepared/controls.json' with { type: 'json' };

export const browserProfile = createObjectBrowserProfile({ id: 'proteus', controls: objectControls,
  audit: {
    preparedAssetPairs: [{ one: '/scenes/proteus/proteus-directional-sun.webp', two: '/scenes/proteus/proteus-directional-sun@2x.webp' }],
    canonicalPreparedAssets: ['/scenes/proteus/proteus-normal-surface@2x.webp', '/scenes/proteus/proteus-lighting.webp'],
    lensRace: { defaultId: 'normal', slowId: 'elevation', winnerId: 'normal',
      slowAsset: '/scenes/proteus/proteus-elevation-surface@2x.webp', preReadyDisabled: true },
    retained: { lensIds: browserProfileLensIds(objectControls), speedClicks: 5, allowedMountSelectors: [] },
  },
});
