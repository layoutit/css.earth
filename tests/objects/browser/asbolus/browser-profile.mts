import { browserProfileLensIds, createObjectBrowserProfile } from '../../../../site/test/object-browser-profile.mts';
import objectControls from '../../../../src/objects/asbolus/prepared/controls.json' with {type:'json'};
export const browserProfile=createObjectBrowserProfile({id:'asbolus',controls:objectControls,audit:{
  canonicalPreparedAssets:['/scenes/asbolus/asbolus-model-surface@2x.webp','/scenes/asbolus/asbolus-lighting.webp'],
  retained:{lensIds:browserProfileLensIds(objectControls),speedClicks:5,allowedMountSelectors:[]},
}});
