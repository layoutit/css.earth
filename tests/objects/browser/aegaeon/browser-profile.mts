import { browserProfileLensIds, createObjectBrowserProfile } from '../../../../site/test/object-browser-profile.mts';
import objectControls from '../../../../src/objects/aegaeon/prepared/controls.json' with {type:'json'};
export const browserProfile=createObjectBrowserProfile({id:'aegaeon',controls:objectControls,audit:{
  preparedAssetPairs:[],
  canonicalPreparedAssets:['/scenes/aegaeon/aegaeon-model-surface@2x.webp','/scenes/aegaeon/aegaeon-lighting.webp'],
  retained:{lensIds:browserProfileLensIds(objectControls),speedClicks:5,allowedMountSelectors:[]},
}});
