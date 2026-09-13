import { createObjectBrowserProfile } from '../../../../site/test/object-browser-profile.mts';
import objectControls from '../../../../src/objects/comet-c2006-p1/prepared/controls.json' with { type: 'json' };
export const browserProfile = createObjectBrowserProfile({ id:'comet-c2006-p1', controls:objectControls,
 audit:{
  preparedAssetPairs:[{one:'/scenes/comet-c2006-p1/comet-c2006-p1-directional-sun.webp',two:'/scenes/comet-c2006-p1/comet-c2006-p1-directional-sun@2x.webp'}],
  canonicalPreparedAssets:['/scenes/comet-c2006-p1/comet-c2006-p1-model-surface@2x.webp','/scenes/comet-c2006-p1/comet-c2006-p1-lighting.webp'],
  retained:{lensIds:['model'],speedClicks:0,allowedMountSelectors:[]},
 },
});
