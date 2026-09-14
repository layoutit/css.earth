import { browserProfileLensIds, createObjectBrowserProfile } from '../../../../site/test/object-browser-profile.mts';
import objectControls from '../../../../src/objects/romulus/prepared/controls.json' with {type:'json'};
export const browserProfile=createObjectBrowserProfile({id:'romulus',controls:objectControls,audit:{
  preparedAssetPairs:[],
  canonicalPreparedAssets:['/scenes/romulus/romulus-model-surface@2x.webp','/scenes/romulus/romulus-lighting.webp'],
  retained:{lensIds:browserProfileLensIds(objectControls),speedClicks:5,allowedMountSelectors:[]},
}});
