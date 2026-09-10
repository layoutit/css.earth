import { createObjectBrowserProfile } from '../../../../site/test/object-browser-profile.mjs';
import objectControls from '../../../../src/planets/comet-46p/prepared/controls.json' with { type: 'json' };
export const browserProfile = createObjectBrowserProfile({ id:'comet-46p', controls:objectControls,
 audit:{
  preparedAssetPairs:[{one:'/scenes/comet-46p/comet-46p-directional-sun.webp',two:'/scenes/comet-46p/comet-46p-directional-sun@2x.webp'}],
  canonicalPreparedAssets:['/scenes/comet-46p/comet-46p-model-surface@2x.webp','/scenes/comet-46p/comet-46p-lighting.webp'],
  retained:{lensIds:['model'],speedClicks:0,allowedMountSelectors:[]},
 },
});
