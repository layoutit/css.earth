import { browserProfileLensIds, createObjectBrowserProfile } from '../../../../site/test/object-browser-profile.mts';
import objectControls from '../../../../src/objects/harpalyke/prepared/controls.json' with {type:'json'};
export const browserProfile=createObjectBrowserProfile({id:'harpalyke',controls:objectControls,audit:{
  canonicalPreparedAssets:['/scenes/harpalyke/harpalyke-model-surface@2x.webp','/scenes/harpalyke/harpalyke-lighting.webp'],
  retained:{lensIds:browserProfileLensIds(objectControls),speedClicks:5,allowedMountSelectors:[]},
}});
