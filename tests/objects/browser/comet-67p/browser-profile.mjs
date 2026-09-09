import { createObjectBrowserProfile } from '../../../../site/test/object-browser-profile.mjs';
import objectControls from '../../../../src/planets/comet-67p/prepared/controls.json' with { type: 'json' };

export const browserProfile = createObjectBrowserProfile({ id: 'comet-67p', controls: objectControls,
  audit: {
    preparedAssetPairs: [{ one: '/scenes/comet-67p/comet-67p-directional-sun.webp', two: '/scenes/comet-67p/comet-67p-directional-sun@2x.webp' }],
    canonicalPreparedAssets: ['/scenes/comet-67p/comet-67p-model-surface@2x.webp', '/scenes/comet-67p/comet-67p-lighting.webp'],
    lensRace: { defaultId: 'model', slowId: 'geology', winnerId: 'regions',
      slowAsset: '/scenes/comet-67p/comet-67p-geology-surface@2x.webp', preReadyDisabled: false },
    retained: { lensIds: objectControls.lenses.controls.map(lens => lens.id), speedClicks: 0, allowedMountSelectors: [] },
  },
});
