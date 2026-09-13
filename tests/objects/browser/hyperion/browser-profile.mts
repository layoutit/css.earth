import { browserProfileLensIds, createObjectBrowserProfile } from '../../../../site/test/object-browser-profile.mts';
import objectControls from '../../../../src/planets/hyperion/prepared/controls.json' with { type: 'json' };

export const browserProfile = createObjectBrowserProfile({ id: 'hyperion', controls: objectControls,
  audit: {
    canonicalPreparedAssets: ['/scenes/hyperion/hyperion-normal-surface@2x.webp', '/scenes/hyperion/hyperion-lighting.webp', '/scenes/hyperion/hyperion-directional-sun@2x.webp'],
    lensRace: { defaultId: 'normal', slowId: 'elevation', winnerId: 'normal',
      slowAsset: '/scenes/hyperion/hyperion-elevation-surface@2x.webp', preReadyDisabled: true },
    retained: { lensIds: browserProfileLensIds(objectControls), speedClicks: 5, allowedMountSelectors: [] },
  },
});
