import { createObjectBrowserProfile } from '../../../../site/test/object-browser-profile.mjs';
import objectControls from '../../../../src/planets/daphnis/prepared/controls.json' with { type: 'json' };

export const browserProfile = createObjectBrowserProfile({ id: 'daphnis', controls: objectControls,
  audit: {
    preparedAssetPairs: [{ one: '/scenes/daphnis/daphnis-directional-sun.webp', two: '/scenes/daphnis/daphnis-directional-sun@2x.webp' }],
    canonicalPreparedAssets: ['/scenes/daphnis/daphnis-normal-surface@2x.webp', '/scenes/daphnis/daphnis-lighting.webp'],
    lensRace: { defaultId: 'normal', slowId: 'elevation', winnerId: 'normal',
      slowAsset: '/scenes/daphnis/daphnis-elevation-surface@2x.webp', preReadyDisabled: true },
    retained: { lensIds: objectControls.lenses.controls.map(lens => lens.id), speedClicks: 5, allowedMountSelectors: [] },
  },
});
