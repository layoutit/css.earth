import {createObjectBrowserProfile} from '../../../../site/test/object-browser-profile.mjs';
import objectControls from '../../../../src/planets/adrastea/prepared/controls.json' with {type:'json'};
export const browserProfile=createObjectBrowserProfile({id:'adrastea',controls:objectControls,audit:{
  preparedAssetPairs:[{one:'/scenes/adrastea/adrastea-directional-sun.webp',two:'/scenes/adrastea/adrastea-directional-sun@2x.webp'}],
  canonicalPreparedAssets:['/scenes/adrastea/adrastea-model-surface@2x.webp','/scenes/adrastea/adrastea-lighting.webp'],
  retained:{lensIds:objectControls.lenses.controls.map(lens=>lens.id),speedClicks:5,allowedMountSelectors:[]},
}});
