import { browserProfileLensIds, createObjectBrowserProfile } from '../../../../site/test/object-browser-profile.mts';
import objectControls from '../../../../src/objects/stephano/prepared/controls.json' with {type:'json'};
export const browserProfile=createObjectBrowserProfile({id:'stephano',controls:objectControls,audit:{
  canonicalPreparedAssets:['/scenes/stephano/stephano-model-surface@2x.webp','/scenes/stephano/stephano-lighting.webp'],
  retained:{lensIds:browserProfileLensIds(objectControls),speedClicks:5,allowedMountSelectors:[]},
}});
