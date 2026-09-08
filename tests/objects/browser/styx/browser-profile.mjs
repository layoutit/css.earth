import {createObjectBrowserProfile} from '../../../../site/test/object-browser-profile.mjs';
import objectControls from '../../../../src/planets/styx/prepared/controls.json' with {type:'json'};
export const browserProfile=createObjectBrowserProfile({id:'styx',controls:objectControls,audit:{
  preparedAssetPairs:[{one:'/scenes/styx/styx-directional-sun.webp',two:'/scenes/styx/styx-directional-sun@2x.webp'}],
  canonicalPreparedAssets:['/scenes/styx/styx-model-surface@2x.webp','/scenes/styx/styx-lighting.webp'],
  retained:{lensIds:objectControls.lenses.controls.map(lens=>lens.id),speedClicks:5,allowedMountSelectors:[]},
}});
