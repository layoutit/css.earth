import { browserProfileLensIds, createObjectBrowserProfile } from '../../../../site/test/object-browser-profile.mts';
import objectControls from '../../../../src/planets/calypso/prepared/controls.json' with { type: 'json' };

export const browserProfile = createObjectBrowserProfile({ id: 'calypso', controls: objectControls,
  audit: {
    preparedAssetPairs: [{ one: '/scenes/calypso/calypso-directional-sun.webp', two: '/scenes/calypso/calypso-directional-sun@2x.webp' }],
    canonicalPreparedAssets: ['/scenes/calypso/calypso-normal-surface@2x.webp', '/scenes/calypso/calypso-lighting.webp'],
    lensRace: { defaultId: 'normal', slowId: 'elevation', winnerId: 'normal',
      slowAsset: '/scenes/calypso/calypso-elevation-surface@2x.webp', preReadyDisabled: true },
    retained: { lensIds: browserProfileLensIds(objectControls), speedClicks: 5, allowedMountSelectors: [] },
  },
});
