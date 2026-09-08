import {createObjectBrowserProfile} from '../../../../site/test/object-browser-profile.mjs';
import objectControls from '../../../../src/planets/despina/prepared/controls.json' with {type:'json'};
export const browserProfile=createObjectBrowserProfile({id:'despina',controls:objectControls,audit:{
  preparedAssetPairs:[{one:'/scenes/despina/despina-directional-sun.webp',two:'/scenes/despina/despina-directional-sun@2x.webp'}],
  canonicalPreparedAssets:['/scenes/despina/despina-model-surface@2x.webp','/scenes/despina/despina-lighting.webp'],
  retained:{lensIds:objectControls.lenses.controls.map(lens=>lens.id),speedClicks:5,allowedMountSelectors:[]},
}});
