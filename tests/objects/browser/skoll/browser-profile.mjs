import {createObjectBrowserProfile} from '../../../../site/test/object-browser-profile.mjs';
import objectControls from '../../../../src/planets/skoll/prepared/controls.json' with {type:'json'};
export const browserProfile=createObjectBrowserProfile({id:'skoll',controls:objectControls,audit:{
  preparedAssetPairs:[{one:'/scenes/skoll/skoll-directional-sun.webp',two:'/scenes/skoll/skoll-directional-sun@2x.webp'}],
  canonicalPreparedAssets:['/scenes/skoll/skoll-model-surface@2x.webp','/scenes/skoll/skoll-lighting.webp'],
  retained:{lensIds:objectControls.lenses.controls.map(lens=>lens.id),speedClicks:5,allowedMountSelectors:[]},
}});
