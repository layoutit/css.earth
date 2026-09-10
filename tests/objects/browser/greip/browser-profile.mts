import { browserProfileLensIds, createObjectBrowserProfile } from '../../../../site/test/object-browser-profile.mts';
import objectControls from '../../../../src/planets/greip/prepared/controls.json' with {type:'json'};
export const browserProfile=createObjectBrowserProfile({id:'greip',controls:objectControls,audit:{
  preparedAssetPairs:[{one:'/scenes/greip/greip-directional-sun.webp',two:'/scenes/greip/greip-directional-sun@2x.webp'}],
  canonicalPreparedAssets:['/scenes/greip/greip-model-surface@2x.webp','/scenes/greip/greip-lighting.webp'],
  retained:{lensIds:browserProfileLensIds(objectControls),speedClicks:5,allowedMountSelectors:[]},
}});
