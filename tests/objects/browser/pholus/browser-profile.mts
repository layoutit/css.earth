import { browserProfileLensIds, createObjectBrowserProfile } from '../../../../site/test/object-browser-profile.mts';
import objectControls from '../../../../src/objects/pholus/prepared/controls.json' with {type:'json'};
export const browserProfile=createObjectBrowserProfile({id:'pholus',controls:objectControls,audit:{
  canonicalPreparedAssets:['/scenes/pholus/pholus-model-surface@2x.webp','/scenes/pholus/pholus-lighting.webp'],
  retained:{lensIds:browserProfileLensIds(objectControls),speedClicks:5,allowedMountSelectors:[]},
}});
