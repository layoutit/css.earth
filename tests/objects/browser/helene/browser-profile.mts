import { browserProfileLensIds, createObjectBrowserProfile } from '../../../../site/test/object-browser-profile.mts';
import objectControls from '../../../../src/objects/helene/prepared/controls.json' with { type: 'json' };

export const browserProfile = createObjectBrowserProfile({ id: 'helene', controls: objectControls,
  audit: {
    canonicalPreparedAssets: ['/scenes/helene/helene-normal-surface@2x.webp', '/scenes/helene/helene-lighting.webp'],
    lensRace: { defaultId: 'normal', slowId: 'elevation', winnerId: 'normal',
      slowAsset: '/scenes/helene/helene-elevation-surface@2x.webp', preReadyDisabled: true },
    retained: { lensIds: browserProfileLensIds(objectControls), speedClicks: 5, allowedMountSelectors: [] },
  },
});
