import { createObjectBrowserProfile } from '../../../../site/test/object-browser-profile.mjs';
import objectControls from '../../../../src/planets/comet-109p/prepared/controls.json' with { type: 'json' };
export const browserProfile = createObjectBrowserProfile({ id:'comet-109p', controls:objectControls,
 audit:{
  preparedAssetPairs:[{one:'/scenes/comet-109p/comet-109p-directional-sun.webp',two:'/scenes/comet-109p/comet-109p-directional-sun@2x.webp'}],
  canonicalPreparedAssets:['/scenes/comet-109p/comet-109p-model-surface@2x.webp','/scenes/comet-109p/comet-109p-lighting.webp'],
  retained:{lensIds:['model'],speedClicks:0,allowedMountSelectors:[]},
 },
});
