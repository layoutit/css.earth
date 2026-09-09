import {createObjectBrowserProfile} from '../../../../site/test/object-browser-profile.mjs';
import objectControls from '../../../../src/planets/bergelmir/prepared/controls.json' with {type:'json'};
export const browserProfile=createObjectBrowserProfile({id:'bergelmir',controls:objectControls,audit:{
  preparedAssetPairs:[{one:'/scenes/bergelmir/bergelmir-directional-sun.webp',two:'/scenes/bergelmir/bergelmir-directional-sun@2x.webp'}],
  canonicalPreparedAssets:['/scenes/bergelmir/bergelmir-model-surface@2x.webp','/scenes/bergelmir/bergelmir-lighting.webp'],
  retained:{lensIds:objectControls.lenses.controls.map(lens=>lens.id),speedClicks:5,allowedMountSelectors:[]},
}});
