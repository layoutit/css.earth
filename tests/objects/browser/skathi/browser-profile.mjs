import {createObjectBrowserProfile} from '../../../../site/test/object-browser-profile.mjs';
import objectControls from '../../../../src/planets/skathi/prepared/controls.json' with {type:'json'};
export const browserProfile=createObjectBrowserProfile({id:'skathi',controls:objectControls,audit:{
  preparedAssetPairs:[{one:'/scenes/skathi/skathi-directional-sun.webp',two:'/scenes/skathi/skathi-directional-sun@2x.webp'}],
  canonicalPreparedAssets:['/scenes/skathi/skathi-model-surface@2x.webp','/scenes/skathi/skathi-lighting.webp'],
  retained:{lensIds:objectControls.lenses.controls.map(lens=>lens.id),speedClicks:5,allowedMountSelectors:[]},
}});
