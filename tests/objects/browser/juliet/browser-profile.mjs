import {createObjectBrowserProfile} from '../../../../site/test/object-browser-profile.mjs';
import objectControls from '../../../../src/planets/juliet/prepared/controls.json' with {type:'json'};
export const browserProfile=createObjectBrowserProfile({id:'juliet',controls:objectControls,audit:{
  preparedAssetPairs:[{one:'/scenes/juliet/juliet-directional-sun.webp',two:'/scenes/juliet/juliet-directional-sun@2x.webp'}],
  canonicalPreparedAssets:['/scenes/juliet/juliet-model-surface@2x.webp','/scenes/juliet/juliet-lighting.webp'],
  retained:{lensIds:objectControls.lenses.controls.map(lens=>lens.id),speedClicks:5,allowedMountSelectors:[]},
}});
