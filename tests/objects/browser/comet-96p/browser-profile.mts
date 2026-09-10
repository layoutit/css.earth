import { createObjectBrowserProfile } from '../../../../site/test/object-browser-profile.mts';
import objectControls from '../../../../src/planets/comet-96p/prepared/controls.json' with { type: 'json' };
export const browserProfile = createObjectBrowserProfile({ id:'comet-96p', controls:objectControls,
 audit:{
  preparedAssetPairs:[{one:'/scenes/comet-96p/comet-96p-directional-sun.webp',two:'/scenes/comet-96p/comet-96p-directional-sun@2x.webp'}],
  canonicalPreparedAssets:['/scenes/comet-96p/comet-96p-model-surface@2x.webp','/scenes/comet-96p/comet-96p-lighting.webp'],
  retained:{lensIds:['model'],speedClicks:0,allowedMountSelectors:[]},
 },
});
