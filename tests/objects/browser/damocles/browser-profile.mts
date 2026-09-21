import { browserProfileLensIds, createObjectBrowserProfile } from '../../../../site/test/object-browser-profile.mts';
import objectControls from '../../../../src/objects/damocles/prepared/controls.json' with {type:'json'};
export const browserProfile=createObjectBrowserProfile({id:'damocles',controls:objectControls,audit:{
  canonicalPreparedAssets:['/scenes/damocles/damocles-model-surface@2x.webp','/scenes/damocles/damocles-lighting.webp'],
  retained:{lensIds:browserProfileLensIds(objectControls),speedClicks:5,allowedMountSelectors:[]},
}});
