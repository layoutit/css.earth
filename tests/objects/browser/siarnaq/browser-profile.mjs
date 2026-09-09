import {createObjectBrowserProfile} from '../../../../site/test/object-browser-profile.mjs';
import objectControls from '../../../../src/planets/siarnaq/prepared/controls.json' with {type:'json'};
export const browserProfile=createObjectBrowserProfile({id:'siarnaq',controls:objectControls,audit:{
  preparedAssetPairs:[{one:'/scenes/siarnaq/siarnaq-directional-sun.webp',two:'/scenes/siarnaq/siarnaq-directional-sun@2x.webp'}],
  canonicalPreparedAssets:['/scenes/siarnaq/siarnaq-model-surface@2x.webp','/scenes/siarnaq/siarnaq-lighting.webp'],
  retained:{lensIds:objectControls.lenses.controls.map(lens=>lens.id),speedClicks:5,allowedMountSelectors:[]},
}});
