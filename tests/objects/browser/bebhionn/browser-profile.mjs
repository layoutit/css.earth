import {createObjectBrowserProfile} from '../../../../site/test/object-browser-profile.mjs';
import objectControls from '../../../../src/planets/bebhionn/prepared/controls.json' with {type:'json'};
export const browserProfile=createObjectBrowserProfile({id:'bebhionn',controls:objectControls,audit:{
  preparedAssetPairs:[{one:'/scenes/bebhionn/bebhionn-directional-sun.webp',two:'/scenes/bebhionn/bebhionn-directional-sun@2x.webp'}],
  canonicalPreparedAssets:['/scenes/bebhionn/bebhionn-model-surface@2x.webp','/scenes/bebhionn/bebhionn-lighting.webp'],
  retained:{lensIds:objectControls.lenses.controls.map(lens=>lens.id),speedClicks:5,allowedMountSelectors:[]},
}});
