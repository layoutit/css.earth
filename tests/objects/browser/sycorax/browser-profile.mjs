import {createObjectBrowserProfile} from '../../../../site/test/object-browser-profile.mjs';
import objectControls from '../../../../src/planets/sycorax/prepared/controls.json' with {type:'json'};
export const browserProfile=createObjectBrowserProfile({id:'sycorax',controls:objectControls,audit:{
  preparedAssetPairs:[{one:'/scenes/sycorax/sycorax-directional-sun.webp',two:'/scenes/sycorax/sycorax-directional-sun@2x.webp'}],
  canonicalPreparedAssets:['/scenes/sycorax/sycorax-model-surface@2x.webp','/scenes/sycorax/sycorax-lighting.webp'],
  retained:{lensIds:objectControls.lenses.controls.map(lens=>lens.id),speedClicks:5,allowedMountSelectors:[]},
}});
