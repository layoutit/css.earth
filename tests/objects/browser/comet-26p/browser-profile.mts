import { createObjectBrowserProfile } from '../../../../site/test/object-browser-profile.mts';
import objectControls from '../../../../src/planets/comet-26p/prepared/controls.json' with { type: 'json' };
export const browserProfile = createObjectBrowserProfile({ id:'comet-26p', controls:objectControls,
 audit:{
  preparedAssetPairs:[{one:'/scenes/comet-26p/comet-26p-directional-sun.webp',two:'/scenes/comet-26p/comet-26p-directional-sun@2x.webp'}],
  canonicalPreparedAssets:['/scenes/comet-26p/comet-26p-model-surface@2x.webp','/scenes/comet-26p/comet-26p-lighting.webp'],
  retained:{lensIds:['model'],speedClicks:0,allowedMountSelectors:[]},
 },
});
