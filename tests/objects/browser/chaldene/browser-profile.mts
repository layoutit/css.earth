import { browserProfileLensIds, createObjectBrowserProfile } from '../../../../site/test/object-browser-profile.mts';
import objectControls from '../../../../src/objects/chaldene/prepared/controls.json' with {type:'json'};
export const browserProfile=createObjectBrowserProfile({id:'chaldene',controls:objectControls,audit:{
  canonicalPreparedAssets:['/scenes/chaldene/chaldene-model-surface@2x.webp','/scenes/chaldene/chaldene-lighting.webp'],
  retained:{lensIds:browserProfileLensIds(objectControls),speedClicks:5,allowedMountSelectors:[]},
}});
