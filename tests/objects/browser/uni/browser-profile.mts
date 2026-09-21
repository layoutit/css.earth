import { browserProfileLensIds, createObjectBrowserProfile } from '../../../../site/test/object-browser-profile.mts';
import objectControls from '../../../../src/objects/uni/prepared/controls.json' with {type:'json'};
export const browserProfile=createObjectBrowserProfile({id:'uni',controls:objectControls,audit:{
  canonicalPreparedAssets:['/scenes/uni/uni-model-surface@2x.webp','/scenes/uni/uni-lighting.webp'],
  retained:{lensIds:browserProfileLensIds(objectControls),speedClicks:5,allowedMountSelectors:[]},
}});
