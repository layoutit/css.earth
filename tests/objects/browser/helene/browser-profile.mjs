import { createObjectBrowserProfile } from '../../../../site/test/object-browser-profile.mjs';
import objectControls from '../../../../src/planets/helene/prepared/controls.json' with { type: 'json' };

export const browserProfile = createObjectBrowserProfile({ id: 'helene', controls: objectControls,
  audit: {
    preparedAssetPairs: [{ one: '/scenes/helene/helene-directional-sun.webp', two: '/scenes/helene/helene-directional-sun@2x.webp' }],
    canonicalPreparedAssets: ['/scenes/helene/helene-normal-surface@2x.webp', '/scenes/helene/helene-lighting.webp'],
    lensRace: { defaultId: 'normal', slowId: 'elevation', winnerId: 'normal',
      slowAsset: '/scenes/helene/helene-elevation-surface@2x.webp', preReadyDisabled: true },
    retained: { lensIds: objectControls.lenses.controls.map(lens => lens.id), speedClicks: 5, allowedMountSelectors: [] },
  },
});
