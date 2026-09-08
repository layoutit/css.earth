import { createObjectBrowserProfile } from '../../../../site/test/object-browser-profile.mjs';
import objectControls from '../../../../src/planets/comet-81p/prepared/controls.json' with { type: 'json' };

export const browserProfile = createObjectBrowserProfile({ id: 'comet-81p', controls: objectControls,
  audit: {
    preparedAssetPairs: [{ one: '/scenes/comet-81p/comet-81p-directional-sun.webp', two: '/scenes/comet-81p/comet-81p-directional-sun@2x.webp' }],
    canonicalPreparedAssets: ['/scenes/comet-81p/comet-81p-model-surface@2x.webp', '/scenes/comet-81p/comet-81p-lighting.webp'],
    retained: { lensIds: ['model'], speedClicks: 0, allowedMountSelectors: [] },
  },
});
