import { browserProfileLensIds, createObjectBrowserProfile } from '../../../../site/test/object-browser-profile.mts';
import objectControls from '../../../../src/objects/setebos/prepared/controls.json' with {type:'json'};
export const browserProfile=createObjectBrowserProfile({id:'setebos',controls:objectControls,audit:{
  canonicalPreparedAssets:['/scenes/setebos/setebos-model-surface@2x.webp','/scenes/setebos/setebos-lighting.webp'],
  retained:{lensIds:browserProfileLensIds(objectControls),speedClicks:5,allowedMountSelectors:[]},
}});
