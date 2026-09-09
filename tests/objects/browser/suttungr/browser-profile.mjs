import {createObjectBrowserProfile} from '../../../../site/test/object-browser-profile.mjs';
import objectControls from '../../../../src/planets/suttungr/prepared/controls.json' with {type:'json'};
export const browserProfile=createObjectBrowserProfile({id:'suttungr',controls:objectControls,audit:{
  preparedAssetPairs:[{one:'/scenes/suttungr/suttungr-directional-sun.webp',two:'/scenes/suttungr/suttungr-directional-sun@2x.webp'}],
  canonicalPreparedAssets:['/scenes/suttungr/suttungr-model-surface@2x.webp','/scenes/suttungr/suttungr-lighting.webp'],
  retained:{lensIds:objectControls.lenses.controls.map(lens=>lens.id),speedClicks:5,allowedMountSelectors:[]},
}});
