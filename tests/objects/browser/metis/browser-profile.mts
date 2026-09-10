import { browserProfileLensIds, createObjectBrowserProfile } from '../../../../site/test/object-browser-profile.mts';
import objectControls from '../../../../src/planets/metis/prepared/controls.json' with { type: 'json' };

export const browserProfile = createObjectBrowserProfile({ id: 'metis', controls: objectControls,
  audit: {
    preparedAssetPairs: [{ one: '/scenes/metis/metis-directional-sun.webp', two: '/scenes/metis/metis-directional-sun@2x.webp' }],
    canonicalPreparedAssets: ['/scenes/metis/metis-normal-surface@2x.webp', '/scenes/metis/metis-lighting.webp'],
    retained: { lensIds: browserProfileLensIds(objectControls), speedClicks: 5, allowedMountSelectors: [] },
  },
});
