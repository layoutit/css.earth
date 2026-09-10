import { createObjectBrowserProfile } from '../../../../site/test/object-browser-profile.mts';
import objectControls from '../../../../src/planets/comet-29p/prepared/controls.json' with { type: 'json' };
export const browserProfile = createObjectBrowserProfile({ id:'comet-29p', controls:objectControls,
 audit:{
  preparedAssetPairs:[{one:'/scenes/comet-29p/comet-29p-directional-sun.webp',two:'/scenes/comet-29p/comet-29p-directional-sun@2x.webp'}],
  canonicalPreparedAssets:['/scenes/comet-29p/comet-29p-model-surface@2x.webp','/scenes/comet-29p/comet-29p-lighting.webp'],
  retained:{lensIds:['model'],speedClicks:0,allowedMountSelectors:[]},
 },
});
