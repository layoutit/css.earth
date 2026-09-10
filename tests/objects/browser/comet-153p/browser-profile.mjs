import { createObjectBrowserProfile } from '../../../../site/test/object-browser-profile.mjs';
import objectControls from '../../../../src/planets/comet-153p/prepared/controls.json' with { type: 'json' };
export const browserProfile = createObjectBrowserProfile({ id:'comet-153p', controls:objectControls,
 audit:{
  preparedAssetPairs:[{one:'/scenes/comet-153p/comet-153p-directional-sun.webp',two:'/scenes/comet-153p/comet-153p-directional-sun@2x.webp'}],
  canonicalPreparedAssets:['/scenes/comet-153p/comet-153p-model-surface@2x.webp','/scenes/comet-153p/comet-153p-lighting.webp'],
  retained:{lensIds:['model'],speedClicks:0,allowedMountSelectors:[]},
 },
});
