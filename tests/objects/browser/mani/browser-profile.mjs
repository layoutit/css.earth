import {createObjectBrowserProfile} from '../../../../site/test/object-browser-profile.mjs';
import objectControls from '../../../../src/planets/mani/prepared/controls.json' with {type:'json'};
export const browserProfile=createObjectBrowserProfile({id:'mani',controls:objectControls,audit:{
  preparedAssetPairs:[{one:'/scenes/mani/mani-directional-sun.webp',two:'/scenes/mani/mani-directional-sun@2x.webp'}],
  canonicalPreparedAssets:['/scenes/mani/mani-model-surface@2x.webp','/scenes/mani/mani-lighting.webp'],
  retained:{lensIds:objectControls.lenses.controls.map(lens=>lens.id),speedClicks:5,allowedMountSelectors:[]},
}});
