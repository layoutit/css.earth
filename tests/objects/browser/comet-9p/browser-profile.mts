import { browserProfileLensIds, createObjectBrowserProfile } from '../../../../site/test/object-browser-profile.mts';
import objectControls from '../../../../src/planets/comet-9p/prepared/controls.json' with { type: 'json' };

export const browserProfile = createObjectBrowserProfile({ id: 'comet-9p', controls: objectControls,
  audit: {
    canonicalPreparedAssets: ['/scenes/comet-9p/comet-9p-constraints-surface@2x.webp', '/scenes/comet-9p/comet-9p-lighting.webp', '/scenes/comet-9p/comet-9p-directional-sun@2x.webp'],
    lensRace: { defaultId: 'constraints', slowId: 'deep-impact', winnerId: 'next',
      slowAsset: '/scenes/comet-9p/comet-9p-deep-impact-surface@2x.webp', preReadyDisabled: true },
    retained: { lensIds: browserProfileLensIds(objectControls), speedClicks: 0, allowedMountSelectors: [] },
  },
});
