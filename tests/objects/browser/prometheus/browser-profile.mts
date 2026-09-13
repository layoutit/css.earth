import { browserProfileLensIds, createObjectBrowserProfile } from '../../../../site/test/object-browser-profile.mts';
import objectControls from '../../../../src/planets/prometheus/prepared/controls.json' with { type: 'json' };

export const browserProfile = createObjectBrowserProfile({ id: 'prometheus', controls: objectControls,
  audit: {
    canonicalPreparedAssets: ['/scenes/prometheus/prometheus-normal-surface@2x.webp', '/scenes/prometheus/prometheus-lighting.webp', '/scenes/prometheus/prometheus-directional-sun@2x.webp'],
    lensRace: { defaultId: 'normal', slowId: 'elevation', winnerId: 'normal',
      slowAsset: '/scenes/prometheus/prometheus-elevation-surface@2x.webp', preReadyDisabled: true },
    retained: { lensIds: browserProfileLensIds(objectControls), speedClicks: 5, allowedMountSelectors: [] },
  },
});
