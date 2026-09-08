import {createObjectBrowserProfile} from '../../../../site/test/object-browser-profile.mjs';
import objectControls from '../../../../src/planets/menoetius/prepared/controls.json' with {type:'json'};
export const browserProfile=createObjectBrowserProfile({id:'menoetius',controls:objectControls,audit:{
  preparedAssetPairs:[{one:'/scenes/menoetius/menoetius-directional-sun.webp',two:'/scenes/menoetius/menoetius-directional-sun@2x.webp'}],
  canonicalPreparedAssets:['/scenes/menoetius/menoetius-model-surface@2x.webp','/scenes/menoetius/menoetius-lighting.webp'],
  retained:{lensIds:objectControls.lenses.controls.map(lens=>lens.id),speedClicks:5,allowedMountSelectors:[]},
}});
