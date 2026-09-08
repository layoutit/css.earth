import {createObjectBrowserProfile} from '../../../../site/test/object-browser-profile.mjs';
import objectControls from '../../../../src/planets/setebos/prepared/controls.json' with {type:'json'};
export const browserProfile=createObjectBrowserProfile({id:'setebos',controls:objectControls,audit:{
  preparedAssetPairs:[{one:'/scenes/setebos/setebos-directional-sun.webp',two:'/scenes/setebos/setebos-directional-sun@2x.webp'}],
  canonicalPreparedAssets:['/scenes/setebos/setebos-model-surface@2x.webp','/scenes/setebos/setebos-lighting.webp'],
  retained:{lensIds:objectControls.lenses.controls.map(lens=>lens.id),speedClicks:5,allowedMountSelectors:[]},
}});
