import { createObjectBrowserProfile } from '../../../../site/test/object-browser-profile.mts';
import objectControls from '../../../../src/objects/comet-c1956-r1/prepared/controls.json' with { type: 'json' };
export const browserProfile = createObjectBrowserProfile({ id:'comet-c1956-r1', controls:objectControls,
 audit:{
  preparedAssetPairs:[],
  canonicalPreparedAssets:['/scenes/comet-c1956-r1/comet-c1956-r1-model-surface@2x.webp','/scenes/comet-c1956-r1/comet-c1956-r1-lighting.webp'],
  retained:{lensIds:['model'],speedClicks:0,allowedMountSelectors:[]},
 },
});
