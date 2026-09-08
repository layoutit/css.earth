import {createObjectBrowserProfile} from '../../../../site/test/object-browser-profile.mjs';
import objectControls from '../../../../src/planets/tarvos/prepared/controls.json' with {type:'json'};
export const browserProfile=createObjectBrowserProfile({id:'tarvos',controls:objectControls,audit:{
  preparedAssetPairs:[{one:'/scenes/tarvos/tarvos-directional-sun.webp',two:'/scenes/tarvos/tarvos-directional-sun@2x.webp'}],
  canonicalPreparedAssets:['/scenes/tarvos/tarvos-model-surface@2x.webp','/scenes/tarvos/tarvos-lighting.webp'],
  retained:{lensIds:objectControls.lenses.controls.map(lens=>lens.id),speedClicks:5,allowedMountSelectors:[]},
}});
