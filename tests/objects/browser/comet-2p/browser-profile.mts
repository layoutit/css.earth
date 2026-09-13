import { createObjectBrowserProfile } from '../../../../site/test/object-browser-profile.mts';
import objectControls from '../../../../src/objects/comet-2p/prepared/controls.json' with { type: 'json' };
export const browserProfile = createObjectBrowserProfile({ id:'comet-2p', controls:objectControls,
 audit:{
  preparedAssetPairs:[{one:'/scenes/comet-2p/comet-2p-directional-sun.webp',two:'/scenes/comet-2p/comet-2p-directional-sun@2x.webp'}],
  canonicalPreparedAssets:['/scenes/comet-2p/comet-2p-model-surface@2x.webp','/scenes/comet-2p/comet-2p-lighting.webp'],
  retained:{lensIds:['model'],speedClicks:0,allowedMountSelectors:[]},
 },
});
