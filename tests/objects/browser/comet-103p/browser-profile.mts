import { browserProfileLensIds, createObjectBrowserProfile } from '../../../../site/test/object-browser-profile.mts';
import objectControls from '../../../../src/objects/comet-103p/prepared/controls.json' with { type: 'json' };

export const browserProfile = createObjectBrowserProfile({ id: 'comet-103p', controls: objectControls,
  audit: {
    canonicalPreparedAssets: ['/scenes/comet-103p/comet-103p-constraints-surface@2x.webp', '/scenes/comet-103p/comet-103p-lighting.webp'],
    lensRace: { defaultId: 'constraints', slowId: 'mri', winnerId: 'model',
      slowAsset: '/scenes/comet-103p/comet-103p-mri-surface@2x.webp', preReadyDisabled: true },
    retained: { lensIds: browserProfileLensIds(objectControls), speedClicks: 0, allowedMountSelectors: [] },
  },
});
