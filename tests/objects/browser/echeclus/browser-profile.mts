import { browserProfileLensIds, createObjectBrowserProfile } from '../../../../site/test/object-browser-profile.mts';
import objectControls from '../../../../src/objects/echeclus/prepared/controls.json' with {type:'json'};
export const browserProfile=createObjectBrowserProfile({id:'echeclus',controls:objectControls,audit:{
  canonicalPreparedAssets:['/scenes/echeclus/echeclus-model-surface@2x.webp','/scenes/echeclus/echeclus-lighting.webp'],
  retained:{lensIds:browserProfileLensIds(objectControls),speedClicks:5,allowedMountSelectors:[]},
}});
