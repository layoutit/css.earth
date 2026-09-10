import { browserProfileLensIds, createObjectBrowserProfile } from '../../../../site/test/object-browser-profile.mts';
import objectControls from '../../../../src/planets/thebe/prepared/controls.json' with { type: 'json' };

export const browserProfile = createObjectBrowserProfile({ id: 'thebe', controls: objectControls,
  audit: {
    preparedAssetPairs: [{ one: '/scenes/thebe/thebe-directional-sun.webp', two: '/scenes/thebe/thebe-directional-sun@2x.webp' }],
    canonicalPreparedAssets: ['/scenes/thebe/thebe-normal-surface@2x.webp', '/scenes/thebe/thebe-lighting.webp'],
    lensRace: { defaultId: 'normal', slowId: 'elevation', winnerId: 'normal',
      slowAsset: '/scenes/thebe/thebe-elevation-surface@2x.webp', preReadyDisabled: true },
    retained: { lensIds: browserProfileLensIds(objectControls), speedClicks: 5, allowedMountSelectors: [] },
  },
});
