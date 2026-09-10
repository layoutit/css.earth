import { browserProfileLensIds, createObjectBrowserProfile } from '../../../../site/test/object-browser-profile.mts';
import objectControls from '../../../../src/planets/janus/prepared/controls.json' with { type: 'json' };

export const browserProfile = createObjectBrowserProfile({ id: 'janus', controls: objectControls,
  audit: {
    preparedAssetPairs: [{ one: '/scenes/janus/janus-directional-sun.webp', two: '/scenes/janus/janus-directional-sun@2x.webp' }],
    canonicalPreparedAssets: ['/scenes/janus/janus-normal-surface@2x.webp', '/scenes/janus/janus-lighting.webp'],
    lensRace: { defaultId: 'normal', slowId: 'elevation', winnerId: 'normal',
      slowAsset: '/scenes/janus/janus-elevation-surface@2x.webp', preReadyDisabled: true },
    retained: { lensIds: browserProfileLensIds(objectControls), speedClicks: 5, allowedMountSelectors: [] },
  },
});
