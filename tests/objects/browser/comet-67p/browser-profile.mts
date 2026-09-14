import { browserProfileLensIds, createObjectBrowserProfile } from '../../../../site/test/object-browser-profile.mts';
import objectControls from '../../../../src/objects/comet-67p/prepared/controls.json' with { type: 'json' };

export const browserProfile = createObjectBrowserProfile({ id: 'comet-67p', controls: objectControls,
  audit: {
    canonicalPreparedAssets: ['/scenes/comet-67p/comet-67p-model-surface@2x.webp', '/scenes/comet-67p/comet-67p-lighting.webp'],
    lensRace: { defaultId: 'model', slowId: 'geology', winnerId: 'regions',
      slowAsset: '/scenes/comet-67p/comet-67p-geology-surface@2x.webp', preReadyDisabled: false },
    retained: { lensIds: browserProfileLensIds(objectControls), speedClicks: 0, allowedMountSelectors: [] },
  },
});
