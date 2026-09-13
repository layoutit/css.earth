import { browserProfileLensIds, createObjectBrowserProfile } from '../../../../site/test/object-browser-profile.mts';
import objectControls from '../../../../src/planets/larissa/prepared/controls.json' with { type: 'json' };

export const browserProfile = createObjectBrowserProfile({ id: 'larissa', controls: objectControls,
  audit: {
    canonicalPreparedAssets: ['/scenes/larissa/larissa-normal-surface@2x.webp', '/scenes/larissa/larissa-lighting.webp', '/scenes/larissa/larissa-directional-sun@2x.webp'],
    lensRace: { defaultId: 'normal', slowId: 'elevation', winnerId: 'normal',
      slowAsset: '/scenes/larissa/larissa-elevation-surface@2x.webp', preReadyDisabled: true },
    retained: { lensIds: browserProfileLensIds(objectControls), speedClicks: 5, allowedMountSelectors: [] },
  },
});
