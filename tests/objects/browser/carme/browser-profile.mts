import { browserProfileLensIds, createObjectBrowserProfile } from '../../../../site/test/object-browser-profile.mts';
import objectControls from '../../../../src/objects/carme/prepared/controls.json' with {type:'json'};
export const browserProfile=createObjectBrowserProfile({id:'carme',controls:objectControls,audit:{
  canonicalPreparedAssets:['/scenes/carme/carme-model-surface@2x.webp','/scenes/carme/carme-lighting.webp'],
  retained:{lensIds:browserProfileLensIds(objectControls),speedClicks:5,allowedMountSelectors:[]},
}});
