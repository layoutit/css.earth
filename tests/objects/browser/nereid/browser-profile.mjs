import {createObjectBrowserProfile} from '../../../../site/test/object-browser-profile.mjs';
import objectControls from '../../../../src/planets/nereid/prepared/controls.json' with {type:'json'};
export const browserProfile=createObjectBrowserProfile({id:'nereid',controls:objectControls,audit:{
  preparedAssetPairs:[{one:'/scenes/nereid/nereid-directional-sun.webp',two:'/scenes/nereid/nereid-directional-sun@2x.webp'}],
  canonicalPreparedAssets:['/scenes/nereid/nereid-model-surface@2x.webp','/scenes/nereid/nereid-lighting.webp'],
  retained:{lensIds:objectControls.lenses.controls.map(lens=>lens.id),speedClicks:5,allowedMountSelectors:[]},
}});
