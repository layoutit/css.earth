import {createObjectBrowserProfile} from '../../../../site/test/object-browser-profile.mjs';
import objectControls from '../../../../src/planets/loge/prepared/controls.json' with {type:'json'};
export const browserProfile=createObjectBrowserProfile({id:'loge',controls:objectControls,audit:{
  preparedAssetPairs:[{one:'/scenes/loge/loge-directional-sun.webp',two:'/scenes/loge/loge-directional-sun@2x.webp'}],
  canonicalPreparedAssets:['/scenes/loge/loge-model-surface@2x.webp','/scenes/loge/loge-lighting.webp'],
  retained:{lensIds:objectControls.lenses.controls.map(lens=>lens.id),speedClicks:5,allowedMountSelectors:[]},
}});
