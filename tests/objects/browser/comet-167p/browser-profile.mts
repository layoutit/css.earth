import { createObjectBrowserProfile } from '../../../../site/test/object-browser-profile.mts';
import objectControls from '../../../../src/planets/comet-167p/prepared/controls.json' with { type: 'json' };
export const browserProfile = createObjectBrowserProfile({ id:'comet-167p', controls:objectControls,
 audit:{
  preparedAssetPairs:[{one:'/scenes/comet-167p/comet-167p-directional-sun.webp',two:'/scenes/comet-167p/comet-167p-directional-sun@2x.webp'}],
  canonicalPreparedAssets:['/scenes/comet-167p/comet-167p-model-surface@2x.webp','/scenes/comet-167p/comet-167p-lighting.webp'],
  retained:{lensIds:['model'],speedClicks:0,allowedMountSelectors:[]},
 },
});
