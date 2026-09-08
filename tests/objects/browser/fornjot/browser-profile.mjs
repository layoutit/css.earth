import {createObjectBrowserProfile} from '../../../../site/test/object-browser-profile.mjs';
import objectControls from '../../../../src/planets/fornjot/prepared/controls.json' with {type:'json'};
export const browserProfile=createObjectBrowserProfile({id:'fornjot',controls:objectControls,audit:{
  preparedAssetPairs:[{one:'/scenes/fornjot/fornjot-directional-sun.webp',two:'/scenes/fornjot/fornjot-directional-sun@2x.webp'}],
  canonicalPreparedAssets:['/scenes/fornjot/fornjot-model-surface@2x.webp','/scenes/fornjot/fornjot-lighting.webp'],
  retained:{lensIds:objectControls.lenses.controls.map(lens=>lens.id),speedClicks:5,allowedMountSelectors:[]},
}});
