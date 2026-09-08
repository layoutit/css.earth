import { createObjectBrowserProfile } from '../../../../site/test/object-browser-profile.mjs';
import objectControls from '../../../../src/planets/telesto/prepared/controls.json' with { type: 'json' };

export const browserProfile = createObjectBrowserProfile({ id: 'telesto', controls: objectControls,
  audit: {
    preparedAssetPairs: [{ one: '/scenes/telesto/telesto-directional-sun.webp', two: '/scenes/telesto/telesto-directional-sun@2x.webp' }],
    canonicalPreparedAssets: ['/scenes/telesto/telesto-normal-surface@2x.webp', '/scenes/telesto/telesto-lighting.webp'],
    lensRace: { defaultId: 'normal', slowId: 'elevation', winnerId: 'normal',
      slowAsset: '/scenes/telesto/telesto-elevation-surface@2x.webp', preReadyDisabled: true },
    retained: { lensIds: objectControls.lenses.controls.map(lens => lens.id), speedClicks: 5, allowedMountSelectors: [] },
  },
});
