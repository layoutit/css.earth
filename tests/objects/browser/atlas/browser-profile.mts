import { browserProfileLensIds, createObjectBrowserProfile } from '../../../../site/test/object-browser-profile.mts';
import objectControls from '../../../../src/objects/atlas/prepared/controls.json' with { type: 'json' };

export const browserProfile = createObjectBrowserProfile({ id: 'atlas', controls: objectControls,
  audit: {
    preparedAssetPairs: [{ one: '/scenes/atlas/atlas-directional-sun.webp', two: '/scenes/atlas/atlas-directional-sun@2x.webp' }],
    canonicalPreparedAssets: ['/scenes/atlas/atlas-normal-surface@2x.webp', '/scenes/atlas/atlas-lighting.webp'],
    lensRace: { defaultId: 'normal', slowId: 'elevation', winnerId: 'normal',
      slowAsset: '/scenes/atlas/atlas-elevation-surface@2x.webp', preReadyDisabled: true },
    retained: { lensIds: browserProfileLensIds(objectControls), speedClicks: 5, allowedMountSelectors: [] },
  },
});
