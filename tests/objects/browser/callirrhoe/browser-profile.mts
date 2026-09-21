import { browserProfileLensIds, createObjectBrowserProfile } from '../../../../site/test/object-browser-profile.mts';
import objectControls from '../../../../src/objects/callirrhoe/prepared/controls.json' with {type:'json'};
export const browserProfile=createObjectBrowserProfile({id:'callirrhoe',controls:objectControls,audit:{
  canonicalPreparedAssets:['/scenes/callirrhoe/callirrhoe-model-surface@2x.webp','/scenes/callirrhoe/callirrhoe-lighting.webp'],
  retained:{lensIds:browserProfileLensIds(objectControls),speedClicks:5,allowedMountSelectors:[]},
}});
