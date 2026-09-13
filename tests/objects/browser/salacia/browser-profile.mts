import { browserProfileLensIds, createObjectBrowserProfile } from '../../../../site/test/object-browser-profile.mts';
import objectControls from '../../../../src/objects/salacia/prepared/controls.json' with {type:'json'};
export const browserProfile=createObjectBrowserProfile({id:'salacia',controls:objectControls,audit:{
  preparedAssetPairs:[{one:'/scenes/salacia/salacia-directional-sun.webp',two:'/scenes/salacia/salacia-directional-sun@2x.webp'}],
  canonicalPreparedAssets:['/scenes/salacia/salacia-model-surface@2x.webp','/scenes/salacia/salacia-lighting.webp'],
  retained:{lensIds:browserProfileLensIds(objectControls),speedClicks:5,allowedMountSelectors:[]},
}});
