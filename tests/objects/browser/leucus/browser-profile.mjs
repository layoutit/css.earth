import {createObjectBrowserProfile} from '../../../../site/test/object-browser-profile.mjs';
import objectControls from '../../../../src/planets/leucus/prepared/controls.json' with {type:'json'};
export const browserProfile=createObjectBrowserProfile({id:'leucus',controls:objectControls,audit:{
  preparedAssetPairs:[{one:'/scenes/leucus/leucus-directional-sun.webp',two:'/scenes/leucus/leucus-directional-sun@2x.webp'}],
  canonicalPreparedAssets:['/scenes/leucus/leucus-model-surface@2x.webp','/scenes/leucus/leucus-lighting.webp'],
  retained:{lensIds:objectControls.lenses.controls.map(lens=>lens.id),speedClicks:5,allowedMountSelectors:[]},
}});
