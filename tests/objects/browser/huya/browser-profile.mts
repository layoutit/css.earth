import { browserProfileLensIds, createObjectBrowserProfile } from '../../../../site/test/object-browser-profile.mts';
import objectControls from '../../../../src/objects/huya/prepared/controls.json' with {type:'json'};
export const browserProfile=createObjectBrowserProfile({id:'huya',controls:objectControls,audit:{
  canonicalPreparedAssets:['/scenes/huya/huya-model-surface@2x.webp','/scenes/huya/huya-lighting.webp'],
  retained:{lensIds:browserProfileLensIds(objectControls),speedClicks:5,allowedMountSelectors:[]},
}});
