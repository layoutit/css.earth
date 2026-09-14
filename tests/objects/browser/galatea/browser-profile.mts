import { browserProfileLensIds, createObjectBrowserProfile } from '../../../../site/test/object-browser-profile.mts';
import objectControls from '../../../../src/objects/galatea/prepared/controls.json' with {type:'json'};
export const browserProfile=createObjectBrowserProfile({id:'galatea',controls:objectControls,audit:{
  canonicalPreparedAssets:['/scenes/galatea/galatea-model-surface@2x.webp','/scenes/galatea/galatea-lighting.webp'],
  retained:{lensIds:browserProfileLensIds(objectControls),speedClicks:5,allowedMountSelectors:[]},
}});
