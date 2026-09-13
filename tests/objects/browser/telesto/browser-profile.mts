import { browserProfileLensIds, createObjectBrowserProfile } from '../../../../site/test/object-browser-profile.mts';
import objectControls from '../../../../src/planets/telesto/prepared/controls.json' with { type: 'json' };

export const browserProfile = createObjectBrowserProfile({ id: 'telesto', controls: objectControls,
  audit: {
    canonicalPreparedAssets: ['/scenes/telesto/telesto-normal-surface@2x.webp', '/scenes/telesto/telesto-lighting.webp', '/scenes/telesto/telesto-directional-sun@2x.webp'],
    lensRace: { defaultId: 'normal', slowId: 'elevation', winnerId: 'normal',
      slowAsset: '/scenes/telesto/telesto-elevation-surface@2x.webp', preReadyDisabled: true },
    retained: { lensIds: browserProfileLensIds(objectControls), speedClicks: 5, allowedMountSelectors: [] },
  },
});
