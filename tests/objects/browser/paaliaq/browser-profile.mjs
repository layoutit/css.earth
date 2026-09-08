import {createObjectBrowserProfile} from '../../../../site/test/object-browser-profile.mjs';
import objectControls from '../../../../src/planets/paaliaq/prepared/controls.json' with {type:'json'};
export const browserProfile=createObjectBrowserProfile({id:'paaliaq',controls:objectControls,audit:{
  preparedAssetPairs:[{one:'/scenes/paaliaq/paaliaq-directional-sun.webp',two:'/scenes/paaliaq/paaliaq-directional-sun@2x.webp'}],
  canonicalPreparedAssets:['/scenes/paaliaq/paaliaq-model-surface@2x.webp','/scenes/paaliaq/paaliaq-lighting.webp'],
  retained:{lensIds:objectControls.lenses.controls.map(lens=>lens.id),speedClicks:5,allowedMountSelectors:[]},
}});
