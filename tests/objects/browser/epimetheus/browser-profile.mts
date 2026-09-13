import { browserProfileLensIds, createObjectBrowserProfile } from '../../../../site/test/object-browser-profile.mts';
import objectControls from '../../../../src/planets/epimetheus/prepared/controls.json' with { type: 'json' };

export const browserProfile = createObjectBrowserProfile({ id: 'epimetheus', controls: objectControls,
  audit: {
    canonicalPreparedAssets: ['/scenes/epimetheus/epimetheus-normal-surface@2x.webp', '/scenes/epimetheus/epimetheus-lighting.webp', '/scenes/epimetheus/epimetheus-directional-sun@2x.webp'],
    lensRace: { defaultId: 'normal', slowId: 'elevation', winnerId: 'normal',
      slowAsset: '/scenes/epimetheus/epimetheus-elevation-surface@2x.webp', preReadyDisabled: true },
    retained: { lensIds: browserProfileLensIds(objectControls), speedClicks: 5, allowedMountSelectors: [] },
  },
});
