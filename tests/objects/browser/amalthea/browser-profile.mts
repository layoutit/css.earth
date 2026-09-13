import { browserProfileLensIds, createObjectBrowserProfile } from '../../../../site/test/object-browser-profile.mts';
import objectControls from '../../../../src/planets/amalthea/prepared/controls.json' with { type: 'json' };

export const browserProfile = createObjectBrowserProfile({ id: 'amalthea', controls: objectControls,
  audit: {
    canonicalPreparedAssets: ['/scenes/amalthea/amalthea-normal-surface@2x.webp', '/scenes/amalthea/amalthea-lighting.webp', '/scenes/amalthea/amalthea-directional-sun@2x.webp'],
    lensRace: { defaultId: 'normal', slowId: 'elevation', winnerId: 'normal',
      slowAsset: '/scenes/amalthea/amalthea-elevation-surface@2x.webp', preReadyDisabled: true },
    retained: { lensIds: browserProfileLensIds(objectControls), speedClicks: 5, allowedMountSelectors: [] },
  },
});
