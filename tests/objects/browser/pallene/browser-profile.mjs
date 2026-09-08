import {createObjectBrowserProfile} from '../../../../site/test/object-browser-profile.mjs';
import objectControls from '../../../../src/planets/pallene/prepared/controls.json' with {type:'json'};
export const browserProfile=createObjectBrowserProfile({id:'pallene',controls:objectControls,audit:{
  preparedAssetPairs:[{one:'/scenes/pallene/pallene-directional-sun.webp',two:'/scenes/pallene/pallene-directional-sun@2x.webp'}],
  canonicalPreparedAssets:['/scenes/pallene/pallene-model-surface@2x.webp','/scenes/pallene/pallene-lighting.webp'],
  retained:{lensIds:objectControls.lenses.controls.map(lens=>lens.id),speedClicks:5,allowedMountSelectors:[]},
}});
