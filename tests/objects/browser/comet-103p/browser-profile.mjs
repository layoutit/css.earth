import { createObjectBrowserProfile } from '../../../../site/test/object-browser-profile.mjs';
import objectControls from '../../../../src/planets/comet-103p/prepared/controls.json' with { type: 'json' };

export const browserProfile = createObjectBrowserProfile({ id: 'comet-103p', controls: objectControls,
  audit: {
    preparedAssetPairs: [{ one: '/scenes/comet-103p/comet-103p-directional-sun.webp', two: '/scenes/comet-103p/comet-103p-directional-sun@2x.webp' }],
    canonicalPreparedAssets: ['/scenes/comet-103p/comet-103p-constraints-surface@2x.webp', '/scenes/comet-103p/comet-103p-lighting.webp'],
    lensRace: { defaultId: 'constraints', slowId: 'mri', winnerId: 'hri',
      slowAsset: '/scenes/comet-103p/comet-103p-mri-surface@2x.webp', preReadyDisabled: true },
    retained: { lensIds: objectControls.lenses.controls.map(lens => lens.id), speedClicks: 0, allowedMountSelectors: [] },
  },
});
