import {createObjectBrowserProfile} from '../../../../site/test/object-browser-profile.mts';
import objectControls from '../../../../src/objects/dinkinesh/prepared/controls.json' with {type:'json'};
export const browserProfile = createObjectBrowserProfile({
  id: 'dinkinesh', controls: objectControls,
  audit: {
    canonicalPreparedAssets: [
      '/scenes/dinkinesh/dinkinesh-tempest-shape-surface@2x.webp',
    ],
    lensRace: {
      defaultId: 'tempest-shape', slowId: 'shape', winnerId: 'tempest-shape',
      slowAsset: '/scenes/dinkinesh/dinkinesh-shape-surface@2x.webp',
      preReadyDisabled: true,
    },
    retained: { lensIds: ['tempest-shape', 'shape'], speedClicks: 5, allowedMountSelectors: [] },
  },
});
