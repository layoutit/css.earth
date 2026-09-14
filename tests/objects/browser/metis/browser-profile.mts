import { browserProfileLensIds, createObjectBrowserProfile } from '../../../../site/test/object-browser-profile.mts';
import objectControls from '../../../../src/objects/metis/prepared/controls.json' with { type: 'json' };

export const browserProfile = createObjectBrowserProfile({ id: 'metis', controls: objectControls,
  audit: {
    canonicalPreparedAssets: ['/scenes/metis/metis-normal-surface@2x.webp', '/scenes/metis/metis-lighting.webp'],
    retained: { lensIds: browserProfileLensIds(objectControls), speedClicks: 5, allowedMountSelectors: [] },
  },
});
