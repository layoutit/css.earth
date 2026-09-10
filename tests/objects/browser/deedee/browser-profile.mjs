import {createObjectBrowserProfile} from '../../../../site/test/object-browser-profile.mjs';
import objectControls from '../../../../src/planets/deedee/prepared/controls.json' with {type:'json'};
export const browserProfile=createObjectBrowserProfile({id:'deedee',controls:objectControls,audit:{
  preparedAssetPairs:[{one:'/scenes/deedee/deedee-directional-sun.webp',two:'/scenes/deedee/deedee-directional-sun@2x.webp'}],
  canonicalPreparedAssets:['/scenes/deedee/deedee-model-surface@2x.webp','/scenes/deedee/deedee-lighting.webp'],
  retained:{lensIds:objectControls.lenses.controls.map(lens=>lens.id),speedClicks:5,allowedMountSelectors:[]},
}});
