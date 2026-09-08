import { createObjectBrowserProfile } from '../../../../site/test/object-browser-profile.mjs';
import objectControls from '../../../../src/planets/larissa/prepared/controls.json' with { type: 'json' };

export const browserProfile = createObjectBrowserProfile({ id: 'larissa', controls: objectControls,
  audit: {
    preparedAssetPairs: [{ one: '/scenes/larissa/larissa-directional-sun.webp', two: '/scenes/larissa/larissa-directional-sun@2x.webp' }],
    canonicalPreparedAssets: ['/scenes/larissa/larissa-normal-surface@2x.webp', '/scenes/larissa/larissa-lighting.webp'],
    lensRace: { defaultId: 'normal', slowId: 'elevation', winnerId: 'normal',
      slowAsset: '/scenes/larissa/larissa-elevation-surface@2x.webp', preReadyDisabled: true },
    retained: { lensIds: objectControls.lenses.controls.map(lens => lens.id), speedClicks: 5, allowedMountSelectors: [] },
  },
});
