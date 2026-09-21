import { browserProfileLensIds, createObjectBrowserProfile } from '../../../../site/test/object-browser-profile.mts';
import objectControls from '../../../../src/objects/vanth/prepared/controls.json' with {type:'json'};
export const browserProfile=createObjectBrowserProfile({id:'vanth',controls:objectControls,audit:{
  canonicalPreparedAssets:['/scenes/vanth/vanth-model-surface@2x.webp','/scenes/vanth/vanth-lighting.webp'],
  retained:{lensIds:browserProfileLensIds(objectControls),speedClicks:5,allowedMountSelectors:[]},
}});
