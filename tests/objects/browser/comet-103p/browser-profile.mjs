import { createObjectBrowserProfile } from '../../../../site/test/object-browser-profile.mjs';
import objectControls from '../../../../src/planets/comet-103p/prepared/controls.json' with { type: 'json' };

export const browserProfile = createObjectBrowserProfile({ id: 'comet-103p', controls: objectControls,
  audit: {
    preparedAssetPairs: [{ one: '/scenes/comet-103p/comet-103p-directional-sun.webp', two: '/scenes/comet-103p/comet-103p-directional-sun@2x.webp' }],
    canonicalPreparedAssets: ['/scenes/comet-103p/comet-103p-constraints-surface@2x.webp', '/scenes/comet-103p/comet-103p-lighting.webp'],
    lensRace: { defaultId: 'constraints', slowId: 'model', winnerId: 'constraints',
      slowAsset: '/scenes/comet-103p/comet-103p-model-surface@2x.webp', preReadyDisabled: true },
    retained: { lensIds: ['constraints', 'model'], speedClicks: 0, allowedMountSelectors: [] },
  },
});
