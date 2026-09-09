import { createObjectBrowserProfile } from '../../../../site/test/object-browser-profile.mjs';
import objectControls from '../../../../src/planets/epimetheus/prepared/controls.json' with { type: 'json' };

export const browserProfile = createObjectBrowserProfile({ id: 'epimetheus', controls: objectControls,
  audit: {
    preparedAssetPairs: [{ one: '/scenes/epimetheus/epimetheus-directional-sun.webp', two: '/scenes/epimetheus/epimetheus-directional-sun@2x.webp' }],
    canonicalPreparedAssets: ['/scenes/epimetheus/epimetheus-normal-surface@2x.webp', '/scenes/epimetheus/epimetheus-lighting.webp'],
    lensRace: { defaultId: 'normal', slowId: 'elevation', winnerId: 'normal',
      slowAsset: '/scenes/epimetheus/epimetheus-elevation-surface@2x.webp', preReadyDisabled: true },
    retained: { lensIds: objectControls.lenses.controls.map(lens => lens.id), speedClicks: 5, allowedMountSelectors: [] },
  },
});
