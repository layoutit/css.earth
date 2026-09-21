import { browserProfileLensIds, createObjectBrowserProfile } from '../../../../site/test/object-browser-profile.mts';
import objectControls from '../../../../src/objects/leda/prepared/controls.json' with {type:'json'};
export const browserProfile=createObjectBrowserProfile({id:'leda',controls:objectControls,audit:{
  canonicalPreparedAssets:['/scenes/leda/leda-model-surface@2x.webp','/scenes/leda/leda-lighting.webp'],
  retained:{lensIds:browserProfileLensIds(objectControls),speedClicks:5,allowedMountSelectors:[]},
}});
