import { browserProfileLensIds, createObjectBrowserProfile } from '../../../../site/test/object-browser-profile.mts';
import objectControls from '../../../../src/planets/hyperion/prepared/controls.json' with { type: 'json' };

export const browserProfile = createObjectBrowserProfile({ id: 'hyperion', controls: objectControls,
  audit: {
    preparedAssetPairs: [{ one: '/scenes/hyperion/hyperion-directional-sun.webp', two: '/scenes/hyperion/hyperion-directional-sun@2x.webp' }],
    canonicalPreparedAssets: ['/scenes/hyperion/hyperion-normal-surface@2x.webp', '/scenes/hyperion/hyperion-lighting.webp'],
    lensRace: { defaultId: 'normal', slowId: 'elevation', winnerId: 'normal',
      slowAsset: '/scenes/hyperion/hyperion-elevation-surface@2x.webp', preReadyDisabled: true },
    retained: { lensIds: browserProfileLensIds(objectControls), speedClicks: 5, allowedMountSelectors: [] },
  },
});
