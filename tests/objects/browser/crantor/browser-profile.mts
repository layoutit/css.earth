import { browserProfileLensIds, createObjectBrowserProfile } from '../../../../site/test/object-browser-profile.mts';
import objectControls from '../../../../src/objects/crantor/prepared/controls.json' with {type:'json'};
export const browserProfile=createObjectBrowserProfile({id:'crantor',controls:objectControls,audit:{
  canonicalPreparedAssets:['/scenes/crantor/crantor-model-surface@2x.webp','/scenes/crantor/crantor-lighting.webp'],
  retained:{lensIds:browserProfileLensIds(objectControls),speedClicks:5,allowedMountSelectors:[]},
}});
