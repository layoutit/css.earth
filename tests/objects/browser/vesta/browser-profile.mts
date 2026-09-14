import { browserProfileLensIds, createObjectBrowserProfile } from '../../../../site/test/object-browser-profile.mts';
import objectControls from '../../../../src/objects/vesta/prepared/controls.json' with { type: 'json' };

export const browserProfile = createObjectBrowserProfile({ id: 'vesta', controls: objectControls,
  audit: {
    canonicalPreparedAssets: ['/scenes/vesta/vesta-normal-surface@2x.webp', '/scenes/vesta/vesta-lighting.webp'],
    lensRace: { defaultId: 'normal', slowId: 'ratios', winnerId: 'normal',
      slowAsset: '/scenes/vesta/vesta-ratios-surface@2x.webp', preReadyDisabled: true },
    retained: { lensIds: browserProfileLensIds(objectControls), speedClicks: 5, allowedMountSelectors: [] },
  },
});
