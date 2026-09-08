import {createObjectBrowserProfile} from '../../../../site/test/object-browser-profile.mjs';
import objectControls from '../../../../src/planets/kiviuq/prepared/controls.json' with {type:'json'};
export const browserProfile=createObjectBrowserProfile({id:'kiviuq',controls:objectControls,audit:{
  preparedAssetPairs:[{one:'/scenes/kiviuq/kiviuq-directional-sun.webp',two:'/scenes/kiviuq/kiviuq-directional-sun@2x.webp'}],
  canonicalPreparedAssets:['/scenes/kiviuq/kiviuq-model-surface@2x.webp','/scenes/kiviuq/kiviuq-lighting.webp'],
  retained:{lensIds:objectControls.lenses.controls.map(lens=>lens.id),speedClicks:5,allowedMountSelectors:[]},
}});
