import {createObjectBrowserProfile} from '../../../../site/test/object-browser-profile.mjs';
import objectControls from '../../../../src/planets/prospero/prepared/controls.json' with {type:'json'};
export const browserProfile=createObjectBrowserProfile({id:'prospero',controls:objectControls,audit:{
  preparedAssetPairs:[{one:'/scenes/prospero/prospero-directional-sun.webp',two:'/scenes/prospero/prospero-directional-sun@2x.webp'}],
  canonicalPreparedAssets:['/scenes/prospero/prospero-model-surface@2x.webp','/scenes/prospero/prospero-lighting.webp'],
  retained:{lensIds:objectControls.lenses.controls.map(lens=>lens.id),speedClicks:5,allowedMountSelectors:[]},
}});
