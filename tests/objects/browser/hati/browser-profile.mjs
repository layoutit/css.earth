import {createObjectBrowserProfile} from '../../../../site/test/object-browser-profile.mjs';
import objectControls from '../../../../src/planets/hati/prepared/controls.json' with {type:'json'};
export const browserProfile=createObjectBrowserProfile({id:'hati',controls:objectControls,audit:{
  preparedAssetPairs:[{one:'/scenes/hati/hati-directional-sun.webp',two:'/scenes/hati/hati-directional-sun@2x.webp'}],
  canonicalPreparedAssets:['/scenes/hati/hati-model-surface@2x.webp','/scenes/hati/hati-lighting.webp'],
  retained:{lensIds:objectControls.lenses.controls.map(lens=>lens.id),speedClicks:5,allowedMountSelectors:[]},
}});
