import { createObjectBrowserProfile } from '../../../../site/test/object-browser-profile.mts';
import objectControls from '../../../../src/objects/comet-19p/prepared/controls.json' with { type: 'json' };

export const browserProfile = createObjectBrowserProfile({ id: 'comet-19p', controls: objectControls,
  audit: {
    preparedAssetPairs: [],
    canonicalPreparedAssets: ['/scenes/comet-19p/comet-19p-micas-surface@2x.webp', '/scenes/comet-19p/comet-19p-lighting.webp'],
    lensRace: { defaultId: 'micas', slowId: 'dlr', winnerId: 'micas',
      slowAsset: '/scenes/comet-19p/comet-19p-dlr-surface@2x.webp', preReadyDisabled: false },
    retained: { lensIds: ['micas', 'usgs', 'dlr', 'height', 'difference'], speedClicks: 0, allowedMountSelectors: [] },
  },
});
