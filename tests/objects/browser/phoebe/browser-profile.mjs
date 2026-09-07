import { createObjectBrowserProfile } from '../../../../site/test/object-browser-profile.mjs';
import objectControls from '../../../../src/planets/phoebe/prepared/controls.json' with { type: 'json' };

export const browserProfile = createObjectBrowserProfile({ id: 'phoebe', controls: objectControls,
  audit: {
    preparedAssetPairs: [{ one: '/scenes/phoebe/phoebe-directional-sun.webp', two: '/scenes/phoebe/phoebe-directional-sun@2x.webp' }],
    canonicalPreparedAssets: ['/scenes/phoebe/phoebe-normal-surface@2x.webp', '/scenes/phoebe/phoebe-lighting.webp'],
    lensRace: { defaultId: 'normal', slowId: 'elevation', winnerId: 'normal',
      slowAsset: '/scenes/phoebe/phoebe-elevation-surface@2x.webp', preReadyDisabled: true },
    retained: { lensIds: objectControls.lenses.controls.map(lens => lens.id), speedClicks: 5, allowedMountSelectors: [] },
  },
});
