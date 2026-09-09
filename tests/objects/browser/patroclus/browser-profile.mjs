import {createObjectBrowserProfile} from '../../../../site/test/object-browser-profile.mjs';
import objectControls from '../../../../src/planets/patroclus/prepared/controls.json' with {type:'json'};
export const browserProfile=createObjectBrowserProfile({id:'patroclus',controls:objectControls,audit:{
  preparedAssetPairs:[{one:'/scenes/patroclus/patroclus-directional-sun.webp',two:'/scenes/patroclus/patroclus-directional-sun@2x.webp'}],
  canonicalPreparedAssets:['/scenes/patroclus/patroclus-model-surface@2x.webp','/scenes/patroclus/patroclus-lighting.webp'],
  retained:{lensIds:objectControls.lenses.controls.map(lens=>lens.id),speedClicks:5,allowedMountSelectors:[]},
}});
