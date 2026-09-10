import { createObjectBrowserProfile } from '../../../../site/test/object-browser-profile.mts';
import objectControls from '../../../../src/planets/comet-1p/prepared/controls.json' with { type: 'json' };

export const browserProfile = createObjectBrowserProfile({ id: 'comet-1p', controls: objectControls,
  audit: {
    preparedAssetPairs: [{ one: '/scenes/comet-1p/comet-1p-directional-sun.webp', two: '/scenes/comet-1p/comet-1p-directional-sun@2x.webp' }],
    canonicalPreparedAssets: ['/scenes/comet-1p/comet-1p-model-surface@2x.webp', '/scenes/comet-1p/comet-1p-lighting.webp'],
    lensRace: { defaultId:'model', slowId:'giotto', winnerId:'model',
      slowAsset:'/scenes/comet-1p/comet-1p-giotto-surface@2x.webp', preReadyDisabled:false },
    retained: { lensIds: ['model', 'giotto'], speedClicks: 0, allowedMountSelectors: [] },
  },
});
