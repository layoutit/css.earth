import { browserProfileLensIds, createObjectBrowserProfile } from '../../../../site/test/object-browser-profile.mts';
import objectControls from '../../../../src/objects/ananke/prepared/controls.json' with {type:'json'};
export const browserProfile=createObjectBrowserProfile({id:'ananke',controls:objectControls,audit:{
  canonicalPreparedAssets:['/scenes/ananke/ananke-model-surface@2x.webp','/scenes/ananke/ananke-lighting.webp'],
  retained:{lensIds:browserProfileLensIds(objectControls),speedClicks:5,allowedMountSelectors:[]},
}});
