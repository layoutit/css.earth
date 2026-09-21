import { browserProfileLensIds, createObjectBrowserProfile } from '../../../../site/test/object-browser-profile.mts';
import objectControls from '../../../../src/objects/ferdinand/prepared/controls.json' with {type:'json'};
export const browserProfile=createObjectBrowserProfile({id:'ferdinand',controls:objectControls,audit:{
  canonicalPreparedAssets:['/scenes/ferdinand/ferdinand-model-surface@2x.webp','/scenes/ferdinand/ferdinand-lighting.webp'],
  retained:{lensIds:browserProfileLensIds(objectControls),speedClicks:5,allowedMountSelectors:[]},
}});
