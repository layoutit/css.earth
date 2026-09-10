import { browserProfileLensIds, createObjectBrowserProfile } from '../../../../site/test/object-browser-profile.mts';
import objectControls from '../../../../src/planets/ixion/prepared/controls.json' with {type:'json'};
export const browserProfile=createObjectBrowserProfile({id:'ixion',controls:objectControls,audit:{
  preparedAssetPairs:[{one:'/scenes/ixion/ixion-directional-sun.webp',two:'/scenes/ixion/ixion-directional-sun@2x.webp'}],
  canonicalPreparedAssets:['/scenes/ixion/ixion-model-surface@2x.webp','/scenes/ixion/ixion-lighting.webp'],
  retained:{lensIds:browserProfileLensIds(objectControls),speedClicks:5,allowedMountSelectors:[]},
}});
