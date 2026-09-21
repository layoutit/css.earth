import { browserProfileLensIds, createObjectBrowserProfile } from '../../../../site/test/object-browser-profile.mts';
import objectControls from '../../../../src/objects/kalyke/prepared/controls.json' with {type:'json'};
export const browserProfile=createObjectBrowserProfile({id:'kalyke',controls:objectControls,audit:{
  canonicalPreparedAssets:['/scenes/kalyke/kalyke-model-surface@2x.webp','/scenes/kalyke/kalyke-lighting.webp'],
  retained:{lensIds:browserProfileLensIds(objectControls),speedClicks:5,allowedMountSelectors:[]},
}});
