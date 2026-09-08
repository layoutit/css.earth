import {createObjectBrowserProfile} from '../../../../site/test/object-browser-profile.mjs';
import objectControls from '../../../../src/planets/hyrrokkin/prepared/controls.json' with {type:'json'};
export const browserProfile=createObjectBrowserProfile({id:'hyrrokkin',controls:objectControls,audit:{
  preparedAssetPairs:[{one:'/scenes/hyrrokkin/hyrrokkin-directional-sun.webp',two:'/scenes/hyrrokkin/hyrrokkin-directional-sun@2x.webp'}],
  canonicalPreparedAssets:['/scenes/hyrrokkin/hyrrokkin-model-surface@2x.webp','/scenes/hyrrokkin/hyrrokkin-lighting.webp'],
  retained:{lensIds:objectControls.lenses.controls.map(lens=>lens.id),speedClicks:5,allowedMountSelectors:[]},
}});
