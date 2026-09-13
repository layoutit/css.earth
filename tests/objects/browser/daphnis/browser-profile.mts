import { browserProfileLensIds, createObjectBrowserProfile } from '../../../../site/test/object-browser-profile.mts';
import objectControls from '../../../../src/planets/daphnis/prepared/controls.json' with { type: 'json' };

export const browserProfile = createObjectBrowserProfile({ id: 'daphnis', controls: objectControls,
  audit: {
    canonicalPreparedAssets: ['/scenes/daphnis/daphnis-normal-surface@2x.webp', '/scenes/daphnis/daphnis-lighting.webp', '/scenes/daphnis/daphnis-directional-sun@2x.webp'],
    lensRace: { defaultId: 'normal', slowId: 'elevation', winnerId: 'normal',
      slowAsset: '/scenes/daphnis/daphnis-elevation-surface@2x.webp', preReadyDisabled: true },
    retained: { lensIds: browserProfileLensIds(objectControls), speedClicks: 5, allowedMountSelectors: [] },
  },
});
