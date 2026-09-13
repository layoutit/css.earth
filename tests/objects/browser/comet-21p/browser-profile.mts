import { createObjectBrowserProfile } from '../../../../site/test/object-browser-profile.mts';
import objectControls from '../../../../src/objects/comet-21p/prepared/controls.json' with { type: 'json' };
export const browserProfile = createObjectBrowserProfile({ id:'comet-21p', controls:objectControls,
 audit:{
  preparedAssetPairs:[{one:'/scenes/comet-21p/comet-21p-directional-sun.webp',two:'/scenes/comet-21p/comet-21p-directional-sun@2x.webp'}],
  canonicalPreparedAssets:['/scenes/comet-21p/comet-21p-model-surface@2x.webp','/scenes/comet-21p/comet-21p-lighting.webp'],
  retained:{lensIds:['model'],speedClicks:0,allowedMountSelectors:[]},
 },
});
