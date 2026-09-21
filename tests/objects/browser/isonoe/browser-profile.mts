import { browserProfileLensIds, createObjectBrowserProfile } from '../../../../site/test/object-browser-profile.mts';
import objectControls from '../../../../src/objects/isonoe/prepared/controls.json' with {type:'json'};
export const browserProfile=createObjectBrowserProfile({id:'isonoe',controls:objectControls,audit:{
  canonicalPreparedAssets:['/scenes/isonoe/isonoe-model-surface@2x.webp','/scenes/isonoe/isonoe-lighting.webp'],
  retained:{lensIds:browserProfileLensIds(objectControls),speedClicks:5,allowedMountSelectors:[]},
}});
