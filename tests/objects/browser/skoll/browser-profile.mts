import { browserProfileLensIds, createObjectBrowserProfile } from '../../../../site/test/object-browser-profile.mts';
import objectControls from '../../../../src/objects/skoll/prepared/controls.json' with {type:'json'};
export const browserProfile=createObjectBrowserProfile({id:'skoll',controls:objectControls,audit:{
  preparedAssetPairs:[{one:'/scenes/skoll/skoll-directional-sun.webp',two:'/scenes/skoll/skoll-directional-sun@2x.webp'}],
  canonicalPreparedAssets:['/scenes/skoll/skoll-model-surface@2x.webp','/scenes/skoll/skoll-lighting.webp'],
  retained:{lensIds:browserProfileLensIds(objectControls),speedClicks:5,allowedMountSelectors:[]},
}});
