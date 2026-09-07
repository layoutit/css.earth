import { createObjectBrowserProfile } from '../../../../site/test/object-browser-profile.mjs';
import objectControls from '../../../../src/planets/vesta/prepared/controls.json' with { type: 'json' };

export const browserProfile = createObjectBrowserProfile({ id: 'vesta', controls: objectControls,
  audit: {
    preparedAssetPairs: [{ one: '/scenes/vesta/vesta-directional-sun.webp', two: '/scenes/vesta/vesta-directional-sun@2x.webp' }],
    canonicalPreparedAssets: ['/scenes/vesta/vesta-normal-surface@2x.webp', '/scenes/vesta/vesta-lighting.webp'],
    lensRace: { defaultId: 'normal', slowId: 'elevation', winnerId: 'normal',
      slowAsset: '/scenes/vesta/vesta-elevation-surface@2x.webp', preReadyDisabled: true },
    retained: { lensIds: objectControls.lenses.controls.map(lens => lens.id), speedClicks: 5, allowedMountSelectors: [] },
  },
});
