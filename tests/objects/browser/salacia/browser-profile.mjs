import {createObjectBrowserProfile} from '../../../../site/test/object-browser-profile.mjs';
import objectControls from '../../../../src/planets/salacia/prepared/controls.json' with {type:'json'};
export const browserProfile=createObjectBrowserProfile({id:'salacia',controls:objectControls,audit:{
  preparedAssetPairs:[{one:'/scenes/salacia/salacia-directional-sun.webp',two:'/scenes/salacia/salacia-directional-sun@2x.webp'}],
  canonicalPreparedAssets:['/scenes/salacia/salacia-model-surface@2x.webp','/scenes/salacia/salacia-lighting.webp'],
  retained:{lensIds:objectControls.lenses.controls.map(lens=>lens.id),speedClicks:5,allowedMountSelectors:[]},
}});
