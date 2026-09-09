import {createObjectBrowserProfile} from '../../../../site/test/object-browser-profile.mjs';
import objectControls from '../../../../src/planets/polymele/prepared/controls.json' with {type:'json'};
export const browserProfile=createObjectBrowserProfile({id:'polymele',controls:objectControls,audit:{
  preparedAssetPairs:[{one:'/scenes/polymele/polymele-directional-sun.webp',two:'/scenes/polymele/polymele-directional-sun@2x.webp'}],
  canonicalPreparedAssets:['/scenes/polymele/polymele-model-surface@2x.webp','/scenes/polymele/polymele-lighting.webp'],
  retained:{lensIds:objectControls.lenses.controls.map(lens=>lens.id),speedClicks:5,allowedMountSelectors:[]},
}});
