import { createObjectBrowserProfile } from '../../../../site/test/object-browser-profile.mjs';
import objectControls from '../../../../src/planets/prometheus/prepared/controls.json' with { type: 'json' };

export const browserProfile = createObjectBrowserProfile({ id: 'prometheus', controls: objectControls,
  audit: {
    preparedAssetPairs: [{ one: '/scenes/prometheus/prometheus-directional-sun.webp', two: '/scenes/prometheus/prometheus-directional-sun@2x.webp' }],
    canonicalPreparedAssets: ['/scenes/prometheus/prometheus-normal-surface@2x.webp', '/scenes/prometheus/prometheus-lighting.webp'],
    lensRace: { defaultId: 'normal', slowId: 'elevation', winnerId: 'normal',
      slowAsset: '/scenes/prometheus/prometheus-elevation-surface@2x.webp', preReadyDisabled: true },
    retained: { lensIds: objectControls.lenses.controls.map(lens => lens.id), speedClicks: 5, allowedMountSelectors: [] },
  },
});
