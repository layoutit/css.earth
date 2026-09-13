import { browserProfileLensIds, createObjectBrowserProfile } from '../../../../site/test/object-browser-profile.mts';
import objectControls from '../../../../src/objects/squannit/prepared/controls.json' with {type:'json'};
export const browserProfile=createObjectBrowserProfile({id:'squannit',controls:objectControls,audit:{
  preparedAssetPairs:[{one:'/scenes/squannit/squannit-directional-sun.webp',two:'/scenes/squannit/squannit-directional-sun@2x.webp'}],
  canonicalPreparedAssets:['/scenes/squannit/squannit-model-surface@2x.webp','/scenes/squannit/squannit-lighting.webp'],
  retained:{lensIds:browserProfileLensIds(objectControls),speedClicks:5,allowedMountSelectors:[]},
}});
