import { browserProfileLensIds, createObjectBrowserProfile } from '../../../../site/test/object-browser-profile.mts';
import objectControls from '../../../../src/objects/halimede/prepared/controls.json' with {type:'json'};
export const browserProfile=createObjectBrowserProfile({id:'halimede',controls:objectControls,audit:{
  canonicalPreparedAssets:['/scenes/halimede/halimede-model-surface@2x.webp','/scenes/halimede/halimede-lighting.webp'],
  retained:{lensIds:browserProfileLensIds(objectControls),speedClicks:5,allowedMountSelectors:[]},
}});
