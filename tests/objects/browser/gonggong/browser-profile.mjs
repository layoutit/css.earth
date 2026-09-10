import {createObjectBrowserProfile} from '../../../../site/test/object-browser-profile.mjs';
import objectControls from '../../../../src/planets/gonggong/prepared/controls.json' with {type:'json'};
export const browserProfile=createObjectBrowserProfile({id:'gonggong',controls:objectControls,audit:{
  preparedAssetPairs:[{one:'/scenes/gonggong/gonggong-directional-sun.webp',two:'/scenes/gonggong/gonggong-directional-sun@2x.webp'}],
  canonicalPreparedAssets:['/scenes/gonggong/gonggong-model-surface@2x.webp','/scenes/gonggong/gonggong-lighting.webp'],
  retained:{lensIds:objectControls.lenses.controls.map(lens=>lens.id),speedClicks:5,allowedMountSelectors:[]},
}});
