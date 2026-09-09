import {createObjectBrowserProfile} from '../../../../site/test/object-browser-profile.mjs';
import objectControls from '../../../../src/planets/galatea/prepared/controls.json' with {type:'json'};
export const browserProfile=createObjectBrowserProfile({id:'galatea',controls:objectControls,audit:{
  preparedAssetPairs:[{one:'/scenes/galatea/galatea-directional-sun.webp',two:'/scenes/galatea/galatea-directional-sun@2x.webp'}],
  canonicalPreparedAssets:['/scenes/galatea/galatea-model-surface@2x.webp','/scenes/galatea/galatea-lighting.webp'],
  retained:{lensIds:objectControls.lenses.controls.map(lens=>lens.id),speedClicks:5,allowedMountSelectors:[]},
}});
