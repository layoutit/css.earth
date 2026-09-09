import {createObjectBrowserProfile} from '../../../../site/test/object-browser-profile.mjs';
import objectControls from '../../../../src/planets/aegaeon/prepared/controls.json' with {type:'json'};
export const browserProfile=createObjectBrowserProfile({id:'aegaeon',controls:objectControls,audit:{
  preparedAssetPairs:[{one:'/scenes/aegaeon/aegaeon-directional-sun.webp',two:'/scenes/aegaeon/aegaeon-directional-sun@2x.webp'}],
  canonicalPreparedAssets:['/scenes/aegaeon/aegaeon-model-surface@2x.webp','/scenes/aegaeon/aegaeon-lighting.webp'],
  retained:{lensIds:objectControls.lenses.controls.map(lens=>lens.id),speedClicks:5,allowedMountSelectors:[]},
}});
