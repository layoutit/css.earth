import {createObjectBrowserProfile} from '../../../../site/test/object-browser-profile.mjs';
import objectControls from '../../../../src/planets/puck/prepared/controls.json' with {type:'json'};
export const browserProfile=createObjectBrowserProfile({id:'puck',controls:objectControls,audit:{
  preparedAssetPairs:[{one:'/scenes/puck/puck-directional-sun.webp',two:'/scenes/puck/puck-directional-sun@2x.webp'}],
  canonicalPreparedAssets:['/scenes/puck/puck-normal-surface@2x.webp','/scenes/puck/puck-lighting.webp'],
  retained:{lensIds:objectControls.lenses.controls.map(lens=>lens.id),speedClicks:5,allowedMountSelectors:[]},
}});
