import { createObjectBrowserProfile } from '../../../../site/test/object-browser-profile.mjs';
import objectControls from '../../../../src/planets/phobos/prepared/controls.json' with { type: 'json' };

export const browserProfile = createObjectBrowserProfile({ id: 'phobos', controls: objectControls,
  audit: {
    preparedAssetPairs: [{ one: '/scenes/phobos/phobos-directional-sun.webp', two: '/scenes/phobos/phobos-directional-sun@2x.webp' }],
    canonicalPreparedAssets: ['/scenes/phobos/phobos-normal-surface@2x.webp', '/scenes/phobos/phobos-lighting.webp'],
    lensRace: { defaultId: 'normal', slowId: 'elevation', winnerId: 'normal',
      slowAsset: '/scenes/phobos/phobos-elevation-surface@2x.webp', preReadyDisabled: true },
    retained: { lensIds: objectControls.lenses.controls.map(lens => lens.id), speedClicks: 5, allowedMountSelectors: [] },
  },
});
