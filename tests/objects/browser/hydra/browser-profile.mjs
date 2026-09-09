import {createObjectBrowserProfile} from '../../../../site/test/object-browser-profile.mjs';
import objectControls from '../../../../src/planets/hydra/prepared/controls.json' with {type:'json'};
export const browserProfile=createObjectBrowserProfile({id:'hydra',controls:objectControls,audit:{
  preparedAssetPairs:[{one:'/scenes/hydra/hydra-directional-sun.webp',two:'/scenes/hydra/hydra-directional-sun@2x.webp'}],
  canonicalPreparedAssets:['/scenes/hydra/hydra-model-surface@2x.webp','/scenes/hydra/hydra-lighting.webp'],
  retained:{lensIds:objectControls.lenses.controls.map(lens=>lens.id),speedClicks:5,allowedMountSelectors:[]},
}});
