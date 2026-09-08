import {createObjectBrowserProfile} from '../../../../site/test/object-browser-profile.mjs';
import objectControls from '../../../../src/planets/ymir/prepared/controls.json' with {type:'json'};
export const browserProfile=createObjectBrowserProfile({id:'ymir',controls:objectControls,audit:{
  preparedAssetPairs:[{one:'/scenes/ymir/ymir-directional-sun.webp',two:'/scenes/ymir/ymir-directional-sun@2x.webp'}],
  canonicalPreparedAssets:['/scenes/ymir/ymir-model-surface@2x.webp','/scenes/ymir/ymir-lighting.webp'],
  retained:{lensIds:objectControls.lenses.controls.map(lens=>lens.id),speedClicks:5,allowedMountSelectors:[]},
}});
