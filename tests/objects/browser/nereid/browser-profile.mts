import { browserProfileLensIds, createObjectBrowserProfile } from '../../../../site/test/object-browser-profile.mts';
import objectControls from '../../../../src/objects/nereid/prepared/controls.json' with {type:'json'};
export const browserProfile=createObjectBrowserProfile({id:'nereid',controls:objectControls,audit:{
  preparedAssetPairs:[],
  canonicalPreparedAssets:['/scenes/nereid/nereid-model-surface@2x.webp','/scenes/nereid/nereid-lighting.webp'],
  retained:{lensIds:browserProfileLensIds(objectControls),speedClicks:5,allowedMountSelectors:[]},
}});
