import { browserProfileLensIds, createObjectBrowserProfile } from '../../../../site/test/object-browser-profile.mts';
import objectControls from '../../../../src/planets/pan/prepared/controls.json' with { type: 'json' };

export const browserProfile = createObjectBrowserProfile({ id: 'pan', controls: objectControls,
  audit: {
    preparedAssetPairs: [{ one: '/scenes/pan/pan-directional-sun.webp', two: '/scenes/pan/pan-directional-sun@2x.webp' }],
    canonicalPreparedAssets: ['/scenes/pan/pan-normal-surface@2x.webp', '/scenes/pan/pan-lighting.webp'],
    lensRace: { defaultId: 'normal', slowId: 'elevation', winnerId: 'normal',
      slowAsset: '/scenes/pan/pan-elevation-surface@2x.webp', preReadyDisabled: true },
    retained: { lensIds: browserProfileLensIds(objectControls), speedClicks: 5, allowedMountSelectors: [] },
  },
});
