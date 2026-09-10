import { createObjectBrowserProfile } from '../../../../site/test/object-browser-profile.mts';
import objectControls from '../../../../src/planets/comet-143p/prepared/controls.json' with { type: 'json' };
export const browserProfile = createObjectBrowserProfile({ id:'comet-143p', controls:objectControls,
 audit:{
  preparedAssetPairs:[{one:'/scenes/comet-143p/comet-143p-directional-sun.webp',two:'/scenes/comet-143p/comet-143p-directional-sun@2x.webp'}],
  canonicalPreparedAssets:['/scenes/comet-143p/comet-143p-model-surface@2x.webp','/scenes/comet-143p/comet-143p-lighting.webp'],
  retained:{lensIds:['model'],speedClicks:0,allowedMountSelectors:[]},
 },
});
