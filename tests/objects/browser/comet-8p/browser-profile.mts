import { createObjectBrowserProfile } from '../../../../site/test/object-browser-profile.mts';
import objectControls from '../../../../src/planets/comet-8p/prepared/controls.json' with { type: 'json' };

export const browserProfile = createObjectBrowserProfile({ id: 'comet-8p', controls: objectControls,
  audit: {
    canonicalPreparedAssets: ['/scenes/comet-8p/comet-8p-model-surface@2x.webp', '/scenes/comet-8p/comet-8p-arecibo-surface@2x.webp', '/scenes/comet-8p/comet-8p-lighting.webp', '/scenes/comet-8p/comet-8p-directional-sun@2x.webp'],
    lensRace: { defaultId: 'model', slowId: 'arecibo', winnerId: 'model',
      slowAsset: '/scenes/comet-8p/comet-8p-arecibo-surface@2x.webp', preReadyDisabled: false },
    retained: { lensIds: ['model', 'arecibo'], speedClicks: 0, allowedMountSelectors: [] },
  },
});
