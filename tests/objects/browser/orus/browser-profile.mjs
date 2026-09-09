import {createObjectBrowserProfile} from '../../../../site/test/object-browser-profile.mjs';
import objectControls from '../../../../src/planets/orus/prepared/controls.json' with {type:'json'};
export const browserProfile=createObjectBrowserProfile({id:'orus',controls:objectControls,audit:{
  preparedAssetPairs:[{one:'/scenes/orus/orus-directional-sun.webp',two:'/scenes/orus/orus-directional-sun@2x.webp'}],
  canonicalPreparedAssets:['/scenes/orus/orus-model-surface@2x.webp','/scenes/orus/orus-lighting.webp'],
  retained:{lensIds:objectControls.lenses.controls.map(lens=>lens.id),speedClicks:5,allowedMountSelectors:[]},
}});
