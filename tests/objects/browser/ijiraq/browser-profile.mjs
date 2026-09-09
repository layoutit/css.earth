import {createObjectBrowserProfile} from '../../../../site/test/object-browser-profile.mjs';
import objectControls from '../../../../src/planets/ijiraq/prepared/controls.json' with {type:'json'};
export const browserProfile=createObjectBrowserProfile({id:'ijiraq',controls:objectControls,audit:{
  preparedAssetPairs:[{one:'/scenes/ijiraq/ijiraq-directional-sun.webp',two:'/scenes/ijiraq/ijiraq-directional-sun@2x.webp'}],
  canonicalPreparedAssets:['/scenes/ijiraq/ijiraq-model-surface@2x.webp','/scenes/ijiraq/ijiraq-lighting.webp'],
  retained:{lensIds:objectControls.lenses.controls.map(lens=>lens.id),speedClicks:5,allowedMountSelectors:[]},
}});
