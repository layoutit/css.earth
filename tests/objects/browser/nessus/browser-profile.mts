import { browserProfileLensIds, createObjectBrowserProfile } from '../../../../site/test/object-browser-profile.mts';
import objectControls from '../../../../src/objects/nessus/prepared/controls.json' with {type:'json'};
export const browserProfile=createObjectBrowserProfile({id:'nessus',controls:objectControls,audit:{
  canonicalPreparedAssets:['/scenes/nessus/nessus-model-surface@2x.webp','/scenes/nessus/nessus-lighting.webp'],
  retained:{lensIds:browserProfileLensIds(objectControls),speedClicks:5,allowedMountSelectors:[]},
}});
