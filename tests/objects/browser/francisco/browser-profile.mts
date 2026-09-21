import { browserProfileLensIds, createObjectBrowserProfile } from '../../../../site/test/object-browser-profile.mts';
import objectControls from '../../../../src/objects/francisco/prepared/controls.json' with {type:'json'};
export const browserProfile=createObjectBrowserProfile({id:'francisco',controls:objectControls,audit:{
  canonicalPreparedAssets:['/scenes/francisco/francisco-model-surface@2x.webp','/scenes/francisco/francisco-lighting.webp'],
  retained:{lensIds:browserProfileLensIds(objectControls),speedClicks:5,allowedMountSelectors:[]},
}});
