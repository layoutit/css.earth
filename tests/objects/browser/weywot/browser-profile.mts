import { browserProfileLensIds, createObjectBrowserProfile } from '../../../../site/test/object-browser-profile.mts';
import objectControls from '../../../../src/objects/weywot/prepared/controls.json' with {type:'json'};
export const browserProfile=createObjectBrowserProfile({id:'weywot',controls:objectControls,audit:{
  canonicalPreparedAssets:['/scenes/weywot/weywot-model-surface@2x.webp','/scenes/weywot/weywot-lighting.webp'],
  retained:{lensIds:browserProfileLensIds(objectControls),speedClicks:5,allowedMountSelectors:[]},
}});
