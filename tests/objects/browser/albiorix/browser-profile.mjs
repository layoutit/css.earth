import {createObjectBrowserProfile} from '../../../../site/test/object-browser-profile.mjs';
import objectControls from '../../../../src/planets/albiorix/prepared/controls.json' with {type:'json'};
export const browserProfile=createObjectBrowserProfile({id:'albiorix',controls:objectControls,audit:{
  preparedAssetPairs:[{one:'/scenes/albiorix/albiorix-directional-sun.webp',two:'/scenes/albiorix/albiorix-directional-sun@2x.webp'}],
  canonicalPreparedAssets:['/scenes/albiorix/albiorix-model-surface@2x.webp','/scenes/albiorix/albiorix-lighting.webp'],
  retained:{lensIds:objectControls.lenses.controls.map(lens=>lens.id),speedClicks:5,allowedMountSelectors:[]},
}});
