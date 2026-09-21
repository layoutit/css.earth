import { browserProfileLensIds, createObjectBrowserProfile } from '../../../../site/test/object-browser-profile.mts';
import objectControls from '../../../../src/objects/erinome/prepared/controls.json' with {type:'json'};
export const browserProfile=createObjectBrowserProfile({id:'erinome',controls:objectControls,audit:{
  canonicalPreparedAssets:['/scenes/erinome/erinome-model-surface@2x.webp','/scenes/erinome/erinome-lighting.webp'],
  retained:{lensIds:browserProfileLensIds(objectControls),speedClicks:5,allowedMountSelectors:[]},
}});
