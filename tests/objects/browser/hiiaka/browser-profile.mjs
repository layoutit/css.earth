import {createObjectBrowserProfile} from '../../../../site/test/object-browser-profile.mjs';
import objectControls from '../../../../src/planets/hiiaka/prepared/controls.json' with {type:'json'};
export const browserProfile=createObjectBrowserProfile({id:'hiiaka',controls:objectControls,audit:{
  preparedAssetPairs:[{one:'/scenes/hiiaka/hiiaka-directional-sun.webp',two:'/scenes/hiiaka/hiiaka-directional-sun@2x.webp'}],
  canonicalPreparedAssets:['/scenes/hiiaka/hiiaka-model-surface@2x.webp','/scenes/hiiaka/hiiaka-lighting.webp'],
  retained:{lensIds:objectControls.lenses.controls.map(lens=>lens.id),speedClicks:5,allowedMountSelectors:[]},
}});
