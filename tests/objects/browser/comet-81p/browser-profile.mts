import { browserProfileLensIds, createObjectBrowserProfile } from '../../../../site/test/object-browser-profile.mts';
import objectControls from '../../../../src/objects/comet-81p/prepared/controls.json' with { type: 'json' };

export const browserProfile = createObjectBrowserProfile({ id: 'comet-81p', controls: objectControls,
  audit: {
    preparedAssetPairs: [{ one: '/scenes/comet-81p/comet-81p-directional-sun.webp', two: '/scenes/comet-81p/comet-81p-directional-sun@2x.webp' }],
    canonicalPreparedAssets: ['/scenes/comet-81p/comet-81p-model-surface@2x.webp', '/scenes/comet-81p/comet-81p-lighting.webp'],
    lensRace: { defaultId: 'model', slowId: 'navcam', winnerId: 'model',
      slowAsset: '/scenes/comet-81p/comet-81p-navcam-surface@2x.webp', preReadyDisabled: true },
    retained: { lensIds: browserProfileLensIds(objectControls), speedClicks: 0, allowedMountSelectors: [] },
  },
});
